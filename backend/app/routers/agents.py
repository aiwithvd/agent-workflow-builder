from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Agent
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate
from app.scheduler import agent_scheduler

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)):
    """List all agents."""
    stmt = select(Agent).order_by(Agent.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get an agent by ID."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(agent: AgentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new agent."""
    db_agent = Agent(**agent.model_dump())
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    agent_scheduler.register(str(db_agent.id), db_agent.schedule)
    return db_agent


@router.patch("/{agent_id}", response_model=AgentRead)
async def update_agent(
    agent_id: UUID, agent_update: AgentUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an agent."""
    db_agent = await db.get(Agent, agent_id)
    if not db_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    update_data = agent_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_agent, key, value)

    await db.commit()
    await db.refresh(db_agent)
    agent_scheduler.register(str(db_agent.id), db_agent.schedule)
    return db_agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete an agent."""
    db_agent = await db.get(Agent, agent_id)
    if not db_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    agent_scheduler.unregister(str(agent_id))
    await db.delete(db_agent)
    await db.commit()
