"""Membership states and their history

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-25

BRD v1.1 §9.3 and §9.6 (Membership: Pending, Active, Suspended, Inactive),
ENT-06 Membership, FR-ADM-003 (GAP-02), BR-014, BR-015, BR-097, PRM-05.

- membership.membership: a member's current state, the reason code and who
  changed it. A member without a row is Pending: nobody has activated them.
- membership.membership_change: every activation, suspension, reinstatement
  and inactivation with its reason, never changed or deleted.
- ops.refuse_change(): a general trigger function that refuses changes to
  append-only tables, used here and by later revisions.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION ops.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION '%.% is append-only', TG_TABLE_SCHEMA, TG_TABLE_NAME;
        END;
        $$
        """
    )
    op.execute("CREATE SCHEMA membership")
    op.execute(
        """
        CREATE TABLE membership.membership (
            member_id   uuid PRIMARY KEY REFERENCES npm.member (id),
            state       text NOT NULL CHECK (state IN ('pending', 'active', 'suspended', 'inactive')),
            reason_code text NOT NULL,
            -- NULL only when the bootstrap command activated the first Super Administrator.
            changed_by  uuid REFERENCES npm.member (id),
            changed_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE membership.membership_change (
            id          bigserial PRIMARY KEY,
            member_id   uuid NOT NULL REFERENCES npm.member (id),
            action      text NOT NULL CHECK (action IN ('activate', 'suspend', 'reinstate', 'inactivate')),
            from_state  text NOT NULL,
            to_state    text NOT NULL,
            reason_code text NOT NULL,
            note        text CHECK (char_length(note) <= 500),
            changed_by  uuid REFERENCES npm.member (id),
            changed_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX membership_change_member ON membership.membership_change (member_id, changed_at)")
    op.execute(
        "CREATE TRIGGER membership_change_append_only BEFORE UPDATE OR DELETE ON membership.membership_change "
        "FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()"
    )
    op.execute(
        "CREATE TRIGGER membership_change_no_truncate BEFORE TRUNCATE ON membership.membership_change "
        "FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_change()"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP SCHEMA membership CASCADE")
    op.execute("DROP FUNCTION ops.refuse_change()")
