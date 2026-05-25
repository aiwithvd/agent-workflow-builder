import asyncio
import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.enums import ExecutionStatus
from app.models import Execution, Message, Workflow
from app.runtime import event_bus
from app.runtime.executor import execution_service
from app.schemas.execution import ExecutionCreate, ExecutionRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/executions", tags=["executions"])


def _to_read(execution: Execution) -> ExecutionRead:
    wf_name = execution.workflow.name if execution.workflow else None
    data = ExecutionRead.model_validate(execution)
    data.workflow_name = wf_name
    return data


# ─── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ExecutionRead])
async def list_executions(
    workflow_id: UUID | None = None, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Execution)
        .options(selectinload(Execution.workflow))
        .order_by(Execution.started_at.desc())
    )
    if workflow_id:
        stmt = stmt.where(Execution.workflow_id == workflow_id)
    result = await db.execute(stmt)
    return [_to_read(e) for e in result.scalars().all()]


@router.get("/{execution_id}", response_model=ExecutionRead)
async def get_execution(execution_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Execution)
        .options(selectinload(Execution.workflow))
        .where(Execution.id == execution_id)
    )
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return _to_read(execution)


@router.post("", response_model=ExecutionRead, status_code=status.HTTP_201_CREATED)
async def create_execution(
    execution_req: ExecutionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create and immediately begin executing a workflow in the background."""
    workflow = await db.get(Workflow, execution_req.workflow_id)
    if not workflow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    execution = Execution(
        workflow_id=execution_req.workflow_id,
        status=ExecutionStatus.QUEUED,
        input=execution_req.input,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Launch the workflow execution in the background
    background_tasks.add_task(
        execution_service.execute_workflow,
        execution_id=execution.id,
        workflow_id=execution.workflow_id,
        input_data=execution.input or {},
        channel=execution_req.channel,
    )

    # Re-fetch with relationship loaded for the response
    stmt = (
        select(Execution)
        .options(selectinload(Execution.workflow))
        .where(Execution.id == execution.id)
    )
    result = await db.execute(stmt)
    return _to_read(result.scalar_one())


# ─── MESSAGES ─────────────────────────────────────────────────────────────────

@router.get("/{execution_id}/messages")
async def get_execution_messages(execution_id: UUID, db: AsyncSession = Depends(get_db)):
    """Return persisted messages for a completed execution."""
    stmt = (
        select(Message)
        .where(Message.execution_id == execution_id)
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "execution_id": str(m.execution_id),
            "agent_id": str(m.agent_id) if m.agent_id else None,
            "message_type": m.message_type,
            "channel": m.channel,
            "content": m.content,
            "token_count": m.token_count,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


# ─── LANGFUSE PROXY ───────────────────────────────────────────────────────────

def _langfuse_auth() -> tuple[str, str]:
    return (settings.langfuse_public_key, settings.langfuse_secret_key)


@router.get("/{execution_id}/traces")
async def get_execution_traces(execution_id: UUID):
    """Proxy Langfuse traces for this execution (keyed by session_id)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.langfuse_host}/api/public/traces",
                params={"sessionId": str(execution_id), "limit": 50},
                auth=_langfuse_auth(),
            )
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 401:
                logger.warning("Langfuse traces returned 401 — credentials not configured")
                return {"data": [], "meta": {"totalItems": 0}, "langfuse_auth_error": True}
            logger.warning("Langfuse traces returned %s", resp.status_code)
            return {"data": [], "meta": {"totalItems": 0}}
    except Exception as e:
        logger.warning("Could not fetch Langfuse traces: %s", e)
        return {"data": [], "meta": {"totalItems": 0}, "error": str(e)}


@router.get("/{execution_id}/metrics")
async def get_execution_metrics(execution_id: UUID):
    """Aggregate token counts and costs for an execution from Langfuse observations."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # First get trace IDs for this session
            traces_resp = await client.get(
                f"{settings.langfuse_host}/api/public/traces",
                params={"sessionId": str(execution_id), "limit": 50},
                auth=_langfuse_auth(),
            )
            if traces_resp.status_code != 200:
                return _empty_metrics()

            traces = traces_resp.json().get("data", [])
            if not traces:
                return _empty_metrics()

            # Aggregate metrics across all traces
            total_prompt_tokens = 0
            total_completion_tokens = 0
            total_cost = 0.0
            latencies_ms: list[float] = []

            for trace in traces:
                usage = trace.get("usage", {}) or {}
                total_prompt_tokens += usage.get("input", 0) or 0
                total_completion_tokens += usage.get("output", 0) or 0
                total_cost += trace.get("totalCost", 0.0) or 0.0

                if trace.get("latency"):
                    latencies_ms.append(trace["latency"])

            return {
                "execution_id": str(execution_id),
                "total_tokens": total_prompt_tokens + total_completion_tokens,
                "prompt_tokens": total_prompt_tokens,
                "completion_tokens": total_completion_tokens,
                "total_cost_usd": round(total_cost, 6),
                "trace_count": len(traces),
                "avg_latency_ms": round(sum(latencies_ms) / len(latencies_ms), 1) if latencies_ms else None,
            }
    except Exception as e:
        logger.warning("Could not fetch Langfuse metrics: %s", e)
        return _empty_metrics()


def _empty_metrics() -> dict:
    return {
        "total_tokens": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_cost_usd": 0.0,
        "trace_count": 0,
        "avg_latency_ms": None,
    }


# ─── WEBSOCKET MONITORING ─────────────────────────────────────────────────────

@router.websocket("/ws/monitor/{execution_id}")
async def websocket_monitor(websocket: WebSocket, execution_id: UUID):
    """Stream live execution events to the client via WebSocket.

    Events are published by ExecutionService into the event bus and forwarded
    here to all connected subscribers.  The connection stays open until the
    execution reaches a terminal state (complete / failed) or the client
    disconnects.
    """
    await websocket.accept()
    exec_id_str = str(execution_id)
    q = event_bus.subscribe(exec_id_str)

    try:
        await websocket.send_json(event_bus.make_event(
            "connection",
            execution_id=exec_id_str,
            message="Connected to live monitor",
        ))

        while True:
            try:
                # Wait up to 30 s for an event; send a heartbeat if none arrives
                event = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json(event_bus.make_event("heartbeat"))
                continue

            await websocket.send_json(event)

            # Stop streaming once the execution reaches a terminal state
            if event.get("type") in ("execution_complete", "execution_failed"):
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json(event_bus.make_event("error", message=str(e)))
        except Exception:
            pass
    finally:
        event_bus.unsubscribe(exec_id_str, q)
        try:
            await websocket.close()
        except Exception:
            pass
