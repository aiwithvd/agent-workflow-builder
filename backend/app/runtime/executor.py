"""Workflow execution engine using LangGraph."""

import asyncio
import json
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Execution, Workflow, Message, Agent
from app.enums import ExecutionStatus, MessageType, MessageChannel
from app.runtime.graph_builder import build_graph_from_definition
from app.runtime.llm_factory import create_llm

logger = logging.getLogger(__name__)


class ExecutionService:
    """Service for executing workflows and managing executions."""

    def __init__(self):
        self.executions = {}

    async def execute_workflow(
        self,
        execution_id: UUID,
        workflow_id: UUID,
        input_data: dict,
        channel: MessageChannel = MessageChannel.WEB,
        on_message_callback=None,
    ) -> dict:
        """Execute a workflow and return the result.

        Args:
            execution_id: Unique execution ID
            workflow_id: Workflow to execute
            input_data: Input data for workflow
            channel: Communication channel
            on_message_callback: Async callback for message events

        Returns:
            Execution result dictionary
        """
        async with async_session() as db:
            # Get workflow and agents
            workflow = await db.get(Workflow, workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")

            # Update execution status
            execution = await db.get(Execution, execution_id)
            if execution:
                execution.status = ExecutionStatus.RUNNING
                await db.commit()

            # Build workflow graph
            try:
                agents_data = await self._get_agents_from_workflow(
                    db, workflow.graph_definition
                )
                graph = build_graph_from_definition(
                    workflow.graph_definition, agents_data
                )
            except Exception as e:
                logger.error(f"Error building graph: {e}")
                if execution:
                    execution.status = ExecutionStatus.FAILED
                    await db.commit()
                raise

            # Execute graph
            try:
                initial_state = {
                    "messages": [
                        {"type": "user", "content": input_data.get("message", "")}
                    ],
                    "execution_id": str(execution_id),
                }

                # Run the graph
                result = await asyncio.to_thread(graph.invoke, initial_state)

                # Store result and mark complete
                if execution:
                    execution.status = ExecutionStatus.COMPLETED
                    execution.output = result
                    execution.completed_at = datetime.utcnow()
                    await db.commit()

                # Notify via callback if provided
                if on_message_callback:
                    await on_message_callback(
                        {
                            "type": "execution_complete",
                            "result": result,
                        }
                    )

                return result

            except Exception as e:
                logger.error(f"Execution error: {e}")
                if execution:
                    execution.status = ExecutionStatus.FAILED
                    execution.output = {"error": str(e)}
                    execution.completed_at = datetime.utcnow()
                    await db.commit()
                raise

    async def _get_agents_from_workflow(
        self, db: AsyncSession, graph_definition: dict
    ) -> dict:
        """Extract agents from workflow graph definition.

        Args:
            db: Database session
            graph_definition: React Flow graph definition

        Returns:
            Dictionary mapping agent IDs to their configurations
        """
        agents_config = {}
        nodes = graph_definition.get("nodes", [])

        for node in nodes:
            node_id = node.get("id")
            node_data = node.get("data", {})
            agent_id = node_data.get("agentId")

            if agent_id:
                agent = await db.get(Agent, agent_id)
                if agent:
                    agents_config[node_id] = {
                        "id": agent_id,
                        "role": agent.role,
                        "system_prompt": agent.system_prompt,
                        "provider": agent.provider,
                        "model": agent.model,
                        "tools": agent.tools,
                    }

        return agents_config

    async def stream_execution(
        self,
        execution_id: UUID,
        workflow_id: UUID,
        input_data: dict,
        channel: MessageChannel,
        message_callback,
    ):
        """Execute workflow and stream messages as they are generated.

        Args:
            execution_id: Unique execution ID
            workflow_id: Workflow to execute
            input_data: Input data
            channel: Communication channel
            message_callback: Async callback for each message event
        """
        try:
            result = await self.execute_workflow(
                execution_id, workflow_id, input_data, channel, message_callback
            )
            return result
        except Exception as e:
            await message_callback({"type": "error", "message": str(e)})
            raise


# Global execution service
execution_service = ExecutionService()
