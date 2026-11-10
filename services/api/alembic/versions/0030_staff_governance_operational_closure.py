"""Staff and governance operational controls.

Revision ID: 0030
Revises: 0029

P2 closes the provisional M1.5/M1.6 foundations without turning proposals
into policy. Machine-readable controls point at an approved P1 decision
revision; offline attendance and aggregate publication remain unavailable
until that version exists. Tier 5 access is certified separately because a
Tier 5 grant cannot be reviewed by the ordinary higher-tier workflow.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE governance.operational_control_version (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            control_key text NOT NULL CHECK (control_key IN (
                'offline_attendance_replay_hours', 'aggregate_minimum_group_size'
            )),
            integer_value integer NOT NULL CHECK (integer_value > 0),
            decision_revision_id uuid NOT NULL REFERENCES ops.policy_decision_revision(id),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
            recorded_by uuid NOT NULL REFERENCES npm.member(id),
            recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (control_key, decision_revision_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX operational_control_latest ON governance.operational_control_version "
        "(control_key, recorded_at DESC)"
    )
    op.execute(
        """
        CREATE TABLE governance.tier5_access_certification (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            assignment_id uuid NOT NULL REFERENCES access.staff_assignment(id),
            decision text NOT NULL CHECK (decision IN ('certified', 'revoked_required')),
            period_start date NOT NULL,
            period_end date NOT NULL,
            reviewer_name text NOT NULL CHECK (char_length(reviewer_name) BETWEEN 2 AND 160),
            reviewer_title text NOT NULL CHECK (char_length(reviewer_title) BETWEEN 2 AND 160),
            evidence_ref text NOT NULL CHECK (char_length(evidence_ref) BETWEEN 3 AND 300),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
            certified_at date NOT NULL,
            recorded_by uuid NOT NULL REFERENCES npm.member(id),
            recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            CHECK (period_end >= period_start),
            UNIQUE (assignment_id, period_start, period_end)
        )
        """
    )
    op.execute(
        "CREATE INDEX tier5_certification_assignment ON governance.tier5_access_certification "
        "(assignment_id, period_end DESC)"
    )
    op.execute(
        "ALTER TABLE governance.policy_version ADD COLUMN approval_reference text "
        "CHECK (approval_reference IS NULL OR char_length(approval_reference) BETWEEN 3 AND 300)"
    )
    op.execute(
        "ALTER TABLE staff_ops.registered_device ADD COLUMN last_seen_at timestamptz"
    )
    for table in ("operational_control_version", "tier5_access_certification"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON governance.{table} "
            "FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()"
        )
        op.execute(
            f"CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON governance.{table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_change()"
        )


def downgrade() -> None:
    raise RuntimeError("Operational control and certification evidence require a reviewed preservation plan")
