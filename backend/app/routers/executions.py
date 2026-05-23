from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Execution, Workflow
from app.schemas.execution import ExecutionCreate, ExecutionRead
from app.enums import ExecutionStatus

router = APIRouter(prefix="/api/v1/executions", tags=["executions"])


@router.get("", response_model=list[ExecutionRead])
async def list_executions(
    workflow_id: UUID | None = None, db: AsyncSession = Depends(get_db)
):
    """List all executions, optionally filtered by workflow."""
    stmt = select(Execution).order_by(Execution.started_at.desc())
    if workflow_id:
        stmt = stmt.where(Execution.workflow_id == workflow_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{execution_id}", response_model=ExecutionRead)
async def get_execution(execution_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get an execution by ID."""
    execution = await db.get(Execution, execution_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found"
        )
    return execution


@router.post("", response_model=ExecutionRead, status_code=status.HTTP_201_CREATED)
async def create_execution(
    execution_req: ExecutionCreate, db: AsyncSession = Depends(get_db)
):
    """Create and queue a new workflow execution."""
    # Verify workflow exists
    workflow = await db.get(Workflow, execution_req.workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
        )

    # Create execution record
    execution = Execution(
        workflow_id=execution_req.workflow_id,
        status=ExecutionStatus.QUEUED,
        input=execution_req.input,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    return execution


@router.websocket("/ws/monitor/{execution_id}")
async def websocket_monitor(websocket: WebSocket, execution_id: UUID):
    """WebSocket endpoint for live execution monitoring."""
    await websocket.accept()

    try:
        # For now, just echo a connection message
        # In Phase 2, this will subscribe to Redis pub/sub
        await websocket.send_json({
            "type": "connection",
            "execution_id": str(execution_id),
            "message": "Connected to live monitor",
        })

        # Keep connection open
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})

    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        await websocket.close()
