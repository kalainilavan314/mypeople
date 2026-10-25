"""Repeated refusals counted, not each written to the audit log

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-25

BRD v1.1 FR-ARCH-002 (refused access is logged) and the review finding of
25 October 2026: every refused staff request wrote an audit entry, so any
signed-in member could fill the append-only, hash-chained log by repeating
one request.

ops.denial_tally: one row per person, permission and reason. The first
refusal in a 10-minute window is written to the audit log; the rest of that
window are only counted here, and the next entry written reports how many
were held back.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ops.denial_tally (
            actor_id          uuid NOT NULL REFERENCES npm.member (id),
            permission        text NOT NULL,
            reason            text NOT NULL,
            window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            suppressed        integer NOT NULL DEFAULT 0 CHECK (suppressed >= 0),
            PRIMARY KEY (actor_id, permission, reason)
        )
        """
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE ops.denial_tally")
