#!/usr/bin/env python3
"""
Migration script: Update all Agent records from 'llama3.2' to valid OpenRouter model.

Usage:
  python migrate_agent_models.py
"""
import asyncio
import sys
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, engine, Base
from app.models import Agent


async def migrate_agent_models():
    """Update all Agent records with model='llama3.2' to valid OpenRouter model."""

    OLD_MODEL = "llama3.2"
    NEW_MODEL = "meta-llama/llama-3.2-3b-instruct:free"

    async with async_session() as db:
        # Count existing agents with old model
        result = await db.execute(
            select(Agent).where(Agent.model == OLD_MODEL)
        )
        old_agents = result.scalars().all()

        if not old_agents:
            print(f"✓ No agents found with model='{OLD_MODEL}' — nothing to migrate")
            return

        print(f"Found {len(old_agents)} agent(s) with model='{OLD_MODEL}':")
        for agent in old_agents:
            print(f"  - {agent.id}: {agent.name}")

        # Update all agents with old model to new model
        stmt = update(Agent).where(Agent.model == OLD_MODEL).values(model=NEW_MODEL)
        result = await db.execute(stmt)
        await db.commit()

        print(f"\n✓ Updated {result.rowcount} agent(s) to model='{NEW_MODEL}'")

        # Verify the update
        result = await db.execute(
            select(Agent).where(Agent.model == NEW_MODEL)
        )
        updated_agents = result.scalars().all()
        print(f"✓ Verification: {len(updated_agents)} agent(s) now using new model")

        return result.rowcount


async def main():
    """Ensure database tables exist, then run migration."""
    try:
        # Create tables if they don't exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print("Database initialized\n")
        count = await migrate_agent_models()

        if count and count > 0:
            print("\n✓ Migration completed successfully")
            sys.exit(0)
        elif count == 0:
            print("\n✓ No migration needed")
            sys.exit(0)
        else:
            print("\n✗ Migration failed")
            sys.exit(1)

    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
