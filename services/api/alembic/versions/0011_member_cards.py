"""Member cards: an opaque card reference per member

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-25

BRD v1.1 FR-CARD-001 to 004, 007, 014, 015, BR-063 to BR-065, FR-ADM-001.

membership.card: the random reference the member QR carries instead of any
identifier (FR-CARD-004). It is replaced when the membership is suspended
or inactivated, so a code shown before then names nobody (FR-CARD-015).
last_scanned_at lets the card screen confirm a successful scan (FR-CARD-007).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE membership.card (
            member_id       uuid PRIMARY KEY REFERENCES npm.member (id),
            card_ref        text NOT NULL UNIQUE,
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            replaced_at     timestamptz,
            last_scanned_at timestamptz,
            last_scanned_by uuid REFERENCES npm.member (id)
        )
        """
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE membership.card")
