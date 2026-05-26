"""Workflow execution engine using LangGraph with Langfuse tracing."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.enums import ExecutionStatus, MessageChannel, MessageType
from app.models import Agent, Execution, Message, Workflow
from app.runtime import event_bus
from app.runtime.graph_builder import build_graph_from_definition

logger = logging.getLogger(__name__)


_langfuse_initialized = False


def _serialize_for_db(obj):
    """Recursively convert LangChain BaseMessage objects to plain dicts.

    SQLAlchemy's JSON column uses stdlib json.dumps which cannot handle
    LangChain message objects returned by create_react_agent.
    """
    from langchain_core.messages import BaseMessage
    if isinstance(obj, BaseMessage):
        return {
            "type": obj.type,
            "content": obj.content if isinstance(obj.content, str) else str(obj.content),
            "name": getattr(obj, "name", None),
        }
    if isinstance(obj, dict):
        return {k: _serialize_for_db(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_for_db(item) for item in obj]
    try:
        import json as _json
        _json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


def _get_langfuse_handler(execution_id: str):
    """Return a Langfuse v3 CallbackHandler tagged with the execution_id.

    Initializes the global Langfuse singleton on first call.  Returns None
    if Langfuse is not configured or the SDK is unavailable so that the
    executor degrades gracefully without crashing the workflow run.
    """
    global _langfuse_initialized
    try:
        from langfuse import Langfuse, get_client
        from langfuse.langchain import CallbackHandler
        from app.config import settings

        if not settings.langfuse_public_key or not settings.langfuse_secret_key:
            logger.warning("Langfuse unavailable, tracing disabled: credentials not set")
            return None

        if not _langfuse_initialized:
            Langfuse(
                public_key=settings.langfuse_public_key,
                secret_key=settings.langfuse_secret_key,
                host=settings.langfuse_host,
            )
            _langfuse_initialized = True

        return CallbackHandler()
    except Exception as e:
        logger.warning("Langfuse unavailable, tracing disabled: %s", e)
        return None


class ExecutionService:
    """Service for executing workflows and managing executions."""

    async def execute_workflow(
        self,
        execution_id: UUID,
        workflow_id: UUID,
        input_data: dict,
        channel: MessageChannel = MessageChannel.WEB,
        thread_id: str | None = None,
    ) -> dict:
        """Execute a workflow, stream events to WebSocket subscribers, and record
        results in the database.

        Args:
            execution_id: UUID of the Execution row (used as default thread_id).
            workflow_id: UUID of the Workflow to run.
            input_data: Dict containing at least ``message`` key.
            channel: Channel that triggered the run (web, telegram, …).
            thread_id: Optional LangGraph thread_id for persistent memory.
                       Telegram handlers pass ``"telegram-{chat_id}"`` so each
                       Telegram user gets a continuous conversation history.
                       Defaults to the execution UUID (fresh context per run).

        This method is designed to run as a FastAPI BackgroundTask.
        """
        exec_id_str = str(execution_id)

        await event_bus.publish(exec_id_str, event_bus.make_event(
            "execution_started",
            execution_id=exec_id_str,
            message="Workflow execution started",
        ))

        async with async_session() as db:
            workflow = await db.get(Workflow, workflow_id)
            if not workflow:
                await self._fail(db, execution_id, exec_id_str, f"Workflow {workflow_id} not found")
                raise ValueError(f"Workflow {workflow_id} not found")

            execution = await db.get(Execution, execution_id)
            if execution:
                execution.status = ExecutionStatus.RUNNING
                await db.commit()

            try:
                agents_data = await self._get_agents_from_workflow(db, workflow.graph_definition)
            except Exception as e:
                await self._fail(db, execution_id, exec_id_str, str(e))
                raise

            await event_bus.publish(exec_id_str, event_bus.make_event(
                "graph_built",
                message=f"Graph built with {len(agents_data)} agent(s)",
                agent_count=len(agents_data),
            ))

            # --- Optional AsyncPostgresSaver for persistent conversation memory ---
            # langgraph-checkpoint-postgres>=3.0.0 changed from_conn_string() to
            # return an async context manager rather than the saver directly.
            # We enter it manually so the connection stays open for the full
            # execution, then exit it in the finally block below.
            checkpointer = None
            _ckpt_ctx = None  # async context manager kept open during the run
            try:
                from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
                from app.config import settings as app_settings

                # psycopg3 needs "postgresql://..." not SQLAlchemy's "postgresql+asyncpg://..."
                pg_url = app_settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
                # Add timeout options so Supabase/Postgres statement_timeout doesn't kill DDL
                separator = "&" if "?" in pg_url else "?"
                pg_url = f"{pg_url}{separator}options=-c%20statement_timeout%3D300000&connect_timeout=10"
                _ckpt_ctx = AsyncPostgresSaver.from_conn_string(pg_url)
                checkpointer = await _ckpt_ctx.__aenter__()
                await checkpointer.setup()
                logger.info(
                    "AsyncPostgresSaver attached for execution %s (thread=%s)",
                    exec_id_str, thread_id or exec_id_str,
                )
            except Exception as ckpt_err:
                logger.error(
                    "Checkpointer unavailable — execution will run without memory: %s", ckpt_err
                )
                checkpointer = None
                _ckpt_ctx = None

            try:
                graph = build_graph_from_definition(
                    workflow.graph_definition, agents_data, checkpointer=checkpointer
                )
            except Exception as e:
                await self._fail(db, execution_id, exec_id_str, str(e))
                raise

            # Langfuse tracing handler — optional, gracefully skipped if unavailable
            lf_handler = _get_langfuse_handler(exec_id_str)
            callbacks = [lf_handler] if lf_handler else []

            initial_state = {
                "messages": [{"type": "user", "content": input_data.get("message", "")}],
                "execution_id": exec_id_str,
            }

            # thread_id drives LangGraph checkpointing — each unique thread_id has
            # its own persistent message history.  Telegram uses "telegram-{chat_id}"
            # so each user retains context; web runs use the execution UUID.
            effective_thread_id = thread_id or exec_id_str

            try:
                config: dict = {"configurable": {"thread_id": effective_thread_id}}
                if callbacks:
                    config["callbacks"] = callbacks
                    # Langfuse v3: session/trace identity goes in metadata, not the handler
                    config["metadata"] = {
                        "langfuse_session_id": exec_id_str,
                        "langfuse_trace_name": f"execution-{exec_id_str[:8]}",
                    }

                # Stream events per node so we can emit live step events
                result = None
                active_nodes: set[str] = set()

                async for event in graph.astream_events(initial_state, config=config, version="v2"):
                    kind = event.get("event", "")
                    name = event.get("name", "")

                    if kind == "on_chain_start" and name not in ("LangGraph", "__start__", "__end__"):
                        active_nodes.add(name)
                        await event_bus.publish(exec_id_str, event_bus.make_event(
                            "step_start",
                            message=f"▶ {name} started",
                            agent_name=name,
                            node_id=name,
                        ))

                    elif kind == "on_chain_end" and name not in ("LangGraph", "__start__", "__end__"):
                        active_nodes.discard(name)
                        # Capture output tokens if available
                        output = event.get("data", {}).get("output", {})
                        await event_bus.publish(exec_id_str, event_bus.make_event(
                            "step_complete",
                            message=f"✓ {name} finished",
                            agent_name=name,
                            node_id=name,
                        ))

                    elif kind == "on_chain_end" and name == "LangGraph":
                        # Final state from the top-level graph
                        result = event.get("data", {}).get("output", {})

                # Fallback: if streaming didn't capture result, invoke directly
                if result is None:
                    result = await graph.ainvoke(initial_state, config=config)

                # Flush Langfuse trace
                if lf_handler:
                    try:
                        lf_handler.flush()
                    except Exception:
                        pass

                # Persist result — serialize LangChain message objects to plain
                # dicts so SQLAlchemy's JSON column can encode them
                execution = await db.get(Execution, execution_id)
                if execution:
                    execution.status = ExecutionStatus.COMPLETED
                    execution.output = _serialize_for_db(result)
                    execution.completed_at = datetime.now(timezone.utc)
                    await db.commit()

                # Persist all messages from the workflow run
                all_messages = result.get("messages", [])
                for msg in all_messages:
                    msg_type = getattr(msg, "type", None) or getattr(msg, "role", None) or "unknown"
                    if isinstance(msg, dict):
                        msg_type = msg.get("type") or msg.get("role") or "unknown"

                    if hasattr(msg, "content"):
                        content = msg.content
                    elif isinstance(msg, dict):
                        content = msg.get("content", str(msg))
                    else:
                        content = str(msg)

                    if isinstance(content, list):
                        content = " ".join(
                            p.get("text", str(p)) if isinstance(p, dict) else str(p)
                            for p in content
                        )

                    # Map to MessageType enum
                    if msg_type in ("human", "user"):
                        m_type = MessageType.USER_INPUT
                    elif msg_type in ("ai", "assistant"):
                        m_type = MessageType.AGENT_RESPONSE
                    elif msg_type == "tool":
                        m_type = MessageType.TOOL_RESULT
                    else:
                        m_type = MessageType.AGENT_RESPONSE

                    # Skip empty content
                    if not content or not str(content).strip():
                        continue

                    await self._persist_message(
                        db,
                        execution_id=execution_id,
                        content=str(content)[:4000],
                        message_type=m_type,
                        from_agent=getattr(msg, "name", None) or msg_type,
                    )

                # Deliver output via configured channels from the output node
                await self._deliver_output(
                    graph_definition=workflow.graph_definition,
                    result=result,
                    input_data=input_data,
                    channel=channel,
                )

                await event_bus.publish(exec_id_str, event_bus.make_event(
                    "execution_complete",
                    message="Workflow completed successfully",
                    status="completed",
                ))

                return result

            except Exception as e:
                logger.error("Execution %s failed: %s", exec_id_str, e)
                await self._fail(db, execution_id, exec_id_str, str(e))
                raise
            finally:
                # Close the checkpointer connection pool when the run ends
                if _ckpt_ctx is not None:
                    try:
                        await _ckpt_ctx.__aexit__(None, None, None)
                    except Exception:
                        pass

    async def _fail(
        self, db: AsyncSession, execution_id: UUID, exec_id_str: str, error: str
    ) -> None:
        """Mark execution as failed in DB and publish failure event."""
        try:
            execution = await db.get(Execution, execution_id)
            if execution:
                execution.status = ExecutionStatus.FAILED
                execution.error = error
                execution.completed_at = datetime.now(timezone.utc)
                await db.commit()
        except Exception as db_err:
            logger.error("Failed to persist failure state: %s", db_err)

        await event_bus.publish(exec_id_str, event_bus.make_event(
            "execution_failed",
            message=error,
            status="failed",
        ))

    async def _get_agents_from_workflow(self, db: AsyncSession, graph_definition: dict) -> dict:
        """Extract agent configs from workflow graph nodes."""
        agents_config = {}
        for node in graph_definition.get("nodes", []):
            node_id = node.get("id")
            agent_id = node.get("data", {}).get("agentId")
            if agent_id:
                agent = await db.get(Agent, agent_id)
                if agent:
                    agents_config[node_id] = {
                        "id": str(agent.id),
                        "role": agent.role,
                        "system_prompt": agent.system_prompt,
                        "provider": agent.provider,
                        "model": agent.model,
                        "tools": agent.tools or [],
                    }
        return agents_config

    @staticmethod
    def _extract_final_text(result: dict) -> str:
        """Pull the last AI message text from a LangGraph result dict."""
        messages = result.get("messages", [])
        for msg in reversed(messages):
            msg_type = getattr(msg, "type", None) or getattr(msg, "role", None)
            if isinstance(msg, dict):
                msg_type = msg.get("type") or msg.get("role")
            content = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else None)
            if msg_type in ("ai", "assistant") and content:
                if isinstance(content, list):
                    return " ".join(
                        p.get("text", str(p)) if isinstance(p, dict) else str(p)
                        for p in content
                    )
                return str(content)
        # Fallback
        if isinstance(result.get("result"), str):
            return result["result"]
        return ""

    async def _deliver_output(
        self,
        graph_definition: dict,
        result: dict,
        input_data: dict,
        channel: MessageChannel,
    ) -> None:
        """Read the output node's delivery config and dispatch side-effects.

        Currently supports:
        - telegram: send result back to the chat_id that triggered the run
        - webhook: POST result JSON to a configured URL
        """
        # Find the output node in the graph definition
        output_node = next(
            (n for n in graph_definition.get("nodes", []) if n.get("type") == "output"),
            None,
        )
        if not output_node:
            return

        delivery = output_node.get("data", {}).get("delivery", {})
        if not delivery:
            return

        final_text = self._extract_final_text(result)
        if not final_text:
            return

        # ── Telegram delivery ─────────────────────────────────────────────────
        if delivery.get("telegram") and input_data.get("chat_id"):
            await self._deliver_telegram(
                chat_id=str(input_data["chat_id"]),
                text=final_text,
            )

        # ── Webhook delivery ──────────────────────────────────────────────────
        webhook_url = delivery.get("webhook_url", "").strip()
        if delivery.get("webhook") and webhook_url:
            await self._deliver_webhook(webhook_url=webhook_url, text=final_text, input_data=input_data)

    @staticmethod
    async def _deliver_telegram(chat_id: str, text: str) -> None:
        """Send text to a Telegram chat via the configured bot token."""
        try:
            import httpx
            from app.database import async_session
            from app.models.settings import PlatformSetting

            async with async_session() as db:
                setting = await db.get(PlatformSetting, "telegram_bot_token")
                token = setting.value if setting else None

            if not token:
                # Fall back to env var
                import os
                token = os.getenv("TELEGRAM_BOT_TOKEN")

            if not token:
                logger.warning("Telegram delivery skipped: no bot token configured")
                return

            url = f"https://api.telegram.org/bot{token}/sendMessage"
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(url, json={"chat_id": chat_id, "text": text[:4096]})
        except Exception as e:
            logger.warning("Telegram delivery failed: %s", e)

    @staticmethod
    async def _deliver_webhook(webhook_url: str, text: str, input_data: dict) -> None:
        """POST the workflow result to a webhook URL."""
        try:
            import httpx
            payload = {
                "result": text,
                "input": input_data,
            }
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(webhook_url, json=payload)
        except Exception as e:
            logger.warning("Webhook delivery to %s failed: %s", webhook_url, e)

    @staticmethod
    async def _persist_message(
        db: AsyncSession,
        execution_id: UUID,
        content: str,
        message_type: MessageType,
        from_agent: str = "system",
        to_agent: str | None = None,
        tokens_used: int | None = None,
    ) -> None:
        """Write a Message record to the database."""
        try:
            msg = Message(
                execution_id=execution_id,
                from_agent=from_agent,
                to_agent=to_agent,
                message_type=message_type,
                channel=MessageChannel.WEB,
                content=content,
                tokens_used=tokens_used,
            )
            db.add(msg)
            await db.commit()
        except Exception as e:
            logger.warning("Could not persist message: %s", e)


# Global singleton used by the API router
execution_service = ExecutionService()
