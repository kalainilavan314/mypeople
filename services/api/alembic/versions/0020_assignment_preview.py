"""Durable database-backed role-assignment preview

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-03

- access.assignment_preview: shared, durable preview record for staff role assignments
  with a 10-minute expiry time, single-use status (active, consumed, cancelled),
  and atomic row-locking on confirmation.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE access.assignment_preview (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            created_by    uuid NOT NULL REFERENCES npm.member (id),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            tier          text NOT NULL CHECK (tier IN ('1', '2A', '2B', '3A', '3B', '4', '5')),
            area_level    text NOT NULL CHECK (area_level IN ('platform', 'province', 'district', 'ds', 'gn')),
            area_code     text,
            permissions   text[] NOT NULL CHECK (cardinality(permissions) > 0),
            note          text,
            review_due_at timestamptz,
            created_at    timestamptz NOT NULL DEFAULT now(),
            expires_at    timestamptz NOT NULL,
            status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'cancelled')),
            consumed_at   timestamptz,
            cancelled_at  timestamptz,
            CONSTRAINT assignment_preview_area_code CHECK ((area_level = 'platform') = (area_code IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX assignment_preview_lookup ON access.assignment_preview (id, created_by, status)")
    op.execute("CREATE INDEX assignment_preview_expires ON access.assignment_preview (expires_at) WHERE status = 'active'")


def downgrade() -> None:
    op.execute("DROP TABLE access.assignment_preview")
