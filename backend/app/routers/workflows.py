import json
import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowRead, WorkflowUpdate
from app.scheduler import sync_schedule_triggers
from app.services.trigger_activator import activate_workflow_triggers, deactivate_workflow_triggers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])

# Templates directory: backend/templates/ → /app/templates/ in Docker
_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"

_TEMPLATE_FILES = {
    "research_report": "research_report.json",
    "customer_support": "customer_support.json",
}


def _load_template(template_name: str) -> dict | None:
    """Load a template JSON file. Returns None if the file is missing."""
    filename = _TEMPLATE_FILES.get(template_name)
    if not filename:
        return None
    path = _TEMPLATES_DIR / filename
    try:
        return json.loads(path.read_text())
    except Exception as e:
        logger.warning("Could not load template %s: %s", template_name, e)
        return None


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    """List all workflows."""
    stmt = select(Workflow).order_by(Workflow.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/templates")
async def list_templates():
    """List available workflow templates with their full graph definitions."""
    templates = []
    for template_name in _TEMPLATE_FILES:
        data = _load_template(template_name)
        if data:
            templates.append({
                "name": template_name,
                "display_name": data.get("name", template_name),
                "description": data.get("description", ""),
                "graph_definition": data.get("graph_definition", {"nodes": [], "edges": []}),
            })
    return {"templates": templates}


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
    # Exclude nodes/edges from dump (already merged into graph_definition by validator)
    db_workflow = Workflow(
        **workflow.model_dump(exclude={"nodes", "edges"})
    )
    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)

    # Sync all trigger nodes (telegram, schedule, web) into DB + APScheduler
    await activate_workflow_triggers(db_workflow.id, db_workflow.graph_definition or {})

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

    update_data = workflow_update.model_dump(exclude_unset=True, exclude={"nodes", "edges"})
    for key, value in update_data.items():
        setattr(db_workflow, key, value)

    await db.commit()
    await db.refresh(db_workflow)

    # Re-sync all trigger nodes (telegram, schedule, web) → DB + APScheduler
    await activate_workflow_triggers(db_workflow.id, db_workflow.graph_definition or {})

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

    # Remove trigger DB rows + APScheduler jobs after commit
    await deactivate_workflow_triggers(workflow_id)
