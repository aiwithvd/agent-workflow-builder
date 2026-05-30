"""
CLI commands for database management and maintenance.

Usage:
  python -m app.commands migrate_agent_models
"""
import asyncio
import sys
from sqlalchemy import select, update

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
            return 0

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
    """CLI entry point."""
    try:
        # Create tables if they don't exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print("Database initialized\n")

        if len(sys.argv) < 2:
            print("Usage: python -m app.commands <command>")
            print("Available commands:")
            print("  migrate_agent_models - Update agents with old 'llama3.2' model ID")
            sys.exit(1)

        command = sys.argv[1]

        if command == "migrate_agent_models":
            count = await migrate_agent_models()
            print(f"\n✓ Operation completed")
            sys.exit(0)
        else:
            print(f"Unknown command: {command}")
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
