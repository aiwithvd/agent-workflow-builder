"""perf indexes and RLS

Revision ID: 001
Revises:
Create Date: 2026-05-24

What this migration does
------------------------
1. Enables pg_uuidv7 (time-ordered UUIDs) and sets server-side defaults on all
   PK columns so new rows get UUIDv7 instead of random UUIDv4.  Existing rows
   are untouched.  pg_uuidv7 may not be available on all Supabase tiers — the
   migration handles the missing-extension case gracefully.

2. Enables Row-Level Security (RLS) on all four tables.  No policies are
   created — absence of a policy = deny for the anon / authenticated roles,
   which blocks direct Data-API access with the anon key.  The SQLAlchemy
   backend connects as the postgres superuser, which bypasses RLS automatically.

3. Adds the following indexes that were missing from the auto-created schema:
   - ix_executions_status          (full index  — status filter on list page)
   - ix_executions_active          (partial     — active executions only)
   - ix_executions_workflow_time   (composite   — workflow + time ordering)
   - ix_messages_execution_time    (composite   — execution log fetch order)
"""
from alembic import op
from sqlalchemy import text

revision = "001_perf_and_security"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. UUIDv7 extension (optional — skip gracefully if unavailable) ───────
    row = conn.execute(
        text("SELECT 1 FROM pg_available_extensions WHERE name = 'pg_uuidv7'")
    ).fetchone()
    if row:
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_uuidv7")
        for table in ("agents", "workflows", "executions", "messages"):
            op.execute(
                f"ALTER TABLE {table} "
                f"ALTER COLUMN id SET DEFAULT uuid_generate_v7()"
            )
    # else: pg_uuidv7 not available on this tier — UUIDv4 defaults stay as-is.

    # ── 2. RLS ────────────────────────────────────────────────────────────────
    for table in ("agents", "workflows", "executions", "messages"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # ── 3. Indexes ────────────────────────────────────────────────────────────

    # Critical: status is queried on every executions list and dashboard load.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_executions_status "
        "ON executions (status)"
    )

    # Partial: only active rows — much smaller, faster for the live monitor.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_executions_active "
        "ON executions (started_at DESC) "
        "WHERE status IN ('queued', 'running')"
    )

    # Composite: filter by workflow + sort by time (workflow detail page).
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_executions_workflow_time "
        "ON executions (workflow_id, started_at DESC)"
    )

    # Composite: fetch all messages for an execution in chronological order.
    # Covers: SELECT * FROM messages WHERE execution_id = $1 ORDER BY created_at
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_execution_time "
        "ON messages (execution_id, created_at ASC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_executions_workflow_time")
    op.execute("DROP INDEX IF EXISTS ix_messages_execution_time")
    op.execute("DROP INDEX IF EXISTS ix_executions_active")
    op.execute("DROP INDEX IF EXISTS ix_executions_status")

    for table in ("messages", "executions", "workflows", "agents"):
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Reset PK defaults back to uuid4 (Python-side default still applies anyway)
    for table in ("agents", "workflows", "executions", "messages"):
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN id DROP DEFAULT"
        )
