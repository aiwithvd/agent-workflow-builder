from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

_url = settings.database_url
_is_sqlite = _url.startswith("sqlite")

# Postgres (Supabase) needs pool tuning and SSL; SQLite needs neither.
_engine_kwargs: dict = {"echo": settings.debug, "future": True}
if not _is_sqlite:
    _engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "connect_args": {"ssl": "require"},
    })

engine = create_async_engine(_url, **_engine_kwargs)

# Session maker
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for all models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Get database session dependency."""
    async with async_session() as session:
        yield session
