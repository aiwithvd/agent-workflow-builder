"""Seed database with template workflows and sample agents."""

import asyncio
import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import engine, Base, async_session
from app.models import Workflow, Agent
from app.enums import LLMProvider, AgentTool, MessageChannel


async def seed_database():
    """Populate database with templates and sample data."""

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Create sample agents
        agents = [
            Agent(
                name="Researcher",
                role="Research Analyst",
                system_prompt="You are a research analyst. Search for information and provide detailed findings.",
                provider=LLMProvider.OLLAMA,
                model="meta-llama/llama-3.2-3b-instruct:free",
                tools=[AgentTool.WEB_SEARCH, AgentTool.CALCULATOR],
                channels=[MessageChannel.WEB, MessageChannel.TELEGRAM],
            ),
            Agent(
                name="Writer",
                role="Report Writer",
                system_prompt="You are a professional report writer. Compile information into clear, structured reports.",
                provider=LLMProvider.OLLAMA,
                model="meta-llama/llama-3.2-3b-instruct:free",
                tools=[AgentTool.FILE_WRITE],
                channels=[MessageChannel.WEB, MessageChannel.TELEGRAM],
            ),
            Agent(
                name="Classifier",
                role="Support Classifier",
                system_prompt="You are a support classifier. Analyze requests and route them to the appropriate team.",
                provider=LLMProvider.OLLAMA,
                model="meta-llama/llama-3.2-3b-instruct:free",
                tools=[AgentTool.WEB_SEARCH],
                channels=[MessageChannel.TELEGRAM],
            ),
            Agent(
                name="Technical Specialist",
                role="Technical Support Specialist",
                system_prompt="You are a technical support specialist. Help resolve technical issues.",
                provider=LLMProvider.OLLAMA,
                model="meta-llama/llama-3.2-3b-instruct:free",
                tools=[AgentTool.WEB_SEARCH, AgentTool.CALCULATOR],
                channels=[MessageChannel.TELEGRAM],
            ),
        ]

        for agent in agents:
            db.add(agent)

        await db.commit()

        # Load templates
        templates_dir = Path(__file__).parent / "templates"

        for template_file in templates_dir.glob("*.json"):
            with open(template_file) as f:
                template_data = json.load(f)

            workflow = Workflow(
                name=template_data["name"],
                description=template_data["description"],
                template_name=template_data["template_name"],
                graph_definition=template_data["graph_definition"],
            )

            db.add(workflow)

        await db.commit()

    print("✅ Database seeded with templates and sample agents")


async def main():
    """Run seeding."""
    try:
        await seed_database()
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
