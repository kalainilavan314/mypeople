"""Add single-use grants for finance slip evidence.

Revision ID: 0028
Revises: 0027
"""

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE finance.slip_view_grant (
            token_id uuid PRIMARY KEY,
            contribution_id uuid NOT NULL REFERENCES finance.contribution(id),
            slip_version integer NOT NULL CHECK (slip_version > 0),
            viewer_id uuid NOT NULL REFERENCES npm.member(id),
            expires_at timestamptz NOT NULL,
            used_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT clock_timestamp()
        );

        CREATE INDEX slip_view_grant_expiry
            ON finance.slip_view_grant (expires_at)
            WHERE used_at IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE finance.slip_view_grant")
