"""Staff access assignments and the append-only audit log

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-25

BRD v1.1 §9 (RB-01 to RB-07), ENT-50 staff_assignment and ENT-26 AuditLog,
§13.8 (separate schemas; audit append-only and hash-chained, BRIN on time).

- access.staff_assignment: one row per assignment of a tier, an area and an
  explicit permission set to a person (W09). Rows are never deleted;
  revoking sets state, ended_at, ended_by and end_reason.
- ops.audit_log: every grant, revocation and refused access. Triggers
  refuse UPDATE, DELETE and TRUNCATE; each row carries the SHA-256 of the
  previous row, so editing or removing one breaks the chain.

The application reads and writes these tables with SQL (see the access and
audit modules), like the Express-owned tables, because they reference
npm.member, which no model declares yet.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA access")
    op.execute(
        """
        CREATE TABLE access.staff_assignment (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            tier          text NOT NULL CHECK (tier IN ('1', '2A', '2B', '3A', '3B', '4', '5')),
            area_level    text NOT NULL CHECK (area_level IN ('platform', 'province', 'district', 'ds', 'gn')),
            area_code     text,
            permissions   text[] NOT NULL CHECK (cardinality(permissions) > 0),
            state         text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked')),
            granted_by    uuid REFERENCES npm.member (id),
            granted_at    timestamptz NOT NULL DEFAULT now(),
            review_due_at timestamptz,
            ended_at      timestamptz,
            ended_by      uuid REFERENCES npm.member (id),
            end_reason    text,
            note          text,
            -- Platform scope has no code; every other scope names one area.
            CONSTRAINT staff_assignment_area_code CHECK ((area_level = 'platform') = (area_code IS NULL)),
            CONSTRAINT staff_assignment_revoked CHECK ((state = 'revoked') = (ended_at IS NOT NULL)),
            -- RB-02: only the bootstrap command (first Super Administrator) has no grantor.
            CONSTRAINT staff_assignment_grantor CHECK (granted_by IS NOT NULL OR tier = '5')
        )
        """
    )
    op.execute(
        "CREATE INDEX staff_assignment_active_member ON access.staff_assignment (member_id) WHERE state = 'active'"
    )

    op.execute("CREATE SCHEMA ops")
    op.execute(
        """
        CREATE TABLE ops.audit_log (
            id          bigserial PRIMARY KEY,
            occurred_at timestamptz NOT NULL,
            actor_id    uuid,
            action      text NOT NULL,
            target_type text,
            target_id   text,
            area_level  text,
            area_code   text,
            -- The area and every area above it, e.g. {province:LK4,district:LK41},
            -- so a regional auditor's query is a simple ANY() match.
            area_path   text[] NOT NULL DEFAULT '{}',
            details     jsonb NOT NULL DEFAULT '{}',
            ip          text,
            prev_hash   text NOT NULL,
            entry_hash  text NOT NULL UNIQUE
        )
        """
    )
    op.execute("CREATE INDEX audit_log_occurred_at ON ops.audit_log USING brin (occurred_at)")
    op.execute("CREATE INDEX audit_log_actor ON ops.audit_log (actor_id)")
    op.execute(
        """
        CREATE FUNCTION ops.refuse_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'ops.audit_log is append-only';
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER audit_log_no_update_or_delete BEFORE UPDATE OR DELETE ON ops.audit_log "
        "FOR EACH ROW EXECUTE FUNCTION ops.refuse_audit_change()"
    )
    op.execute(
        "CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON ops.audit_log "
        "FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_audit_change()"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP SCHEMA ops CASCADE")
    op.execute("DROP SCHEMA access CASCADE")
