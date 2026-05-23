from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowRead, WorkflowUpdate
from app.enums import WorkflowTemplate

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    """List all workflows."""
    stmt = select(Workflow).order_by(Workflow.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/templates")
async def list_templates():
    """List available workflow templates."""
    return {
        "templates": [
            {
                "name": WorkflowTemplate.RESEARCH_REPORT,
                "description": "Research & Report Pipeline - Search and compile information",
            },
            {
                "name": WorkflowTemplate.CUSTOMER_SUPPORT,
                "description": "Customer Support Triage - Classify and route support requests",
            },
        ]
    }


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a workflow by ID."""
    workflow = await db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
        )
    return workflow


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow: WorkflowCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new workflow."""
    db_workflow = Workflow(**workflow.model_dump())
    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    return db_workflow


@router.patch("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: UUID,
    workflow_update: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a workflow."""
    db_workflow = await db.get(Workflow, workflow_id)
    if not db_workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
        )

    update_data = workflow_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_workflow, key, value)

    await db.commit()
    await db.refresh(db_workflow)
    return db_workflow


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a workflow."""
    db_workflow = await db.get(Workflow, workflow_id)
    if not db_workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
        )

    await db.delete(db_workflow)
    await db.commit()
