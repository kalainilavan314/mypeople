"""Baseline: the schema built by the Express migrations 0000 to 0011

Revision ID: 0001
Revises:
Create Date: 2026-10-24

Before Alembic, server/migrations/0000_geo_reference.sql to
0011_session_revocation.sql created the npm and geo schemas and
public.error_log. This revision records that starting point and changes
nothing. alembic/env.py refuses to run unless all twelve files are in the
Express ledger (app/db/express_baseline.py).

Existing database: alembic stamp 0001
New database: npm run migrate --prefix server, then alembic upgrade head

Every schema change after this point is a new Alembic revision.
"""

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
