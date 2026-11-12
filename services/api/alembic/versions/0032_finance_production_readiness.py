"""Finance production controls and release-readiness evidence.

Revision ID: 0032
Revises: 0031

P3 keeps operational values separate from free-form policy text. Every value
points at the exact approved P1 decision revision that authorised it, so a new
revision makes the old control stale without mutating financial history.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE finance.production_control_version (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            control_key text NOT NULL CHECK (control_key IN (
                'enhanced_review_threshold_minor',
                'statutory_reporting_mode',
                'slip_retention_days',
                'third_party_payment_mode',
                'pilot_currency'
            )),
            decision_revision_id uuid NOT NULL REFERENCES ops.policy_decision_revision(id),
            integer_value bigint,
            text_value text,
            evidence_ref text NOT NULL CHECK (char_length(evidence_ref) BETWEEN 3 AND 300),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
            recorded_by uuid NOT NULL REFERENCES npm.member(id),
            recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (control_key, decision_revision_id),
            CHECK (
                (control_key IN ('enhanced_review_threshold_minor', 'slip_retention_days')
                    AND integer_value IS NOT NULL AND text_value IS NULL)
                OR
                (control_key IN ('statutory_reporting_mode', 'third_party_payment_mode', 'pilot_currency')
                    AND text_value IS NOT NULL AND integer_value IS NULL)
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX finance_production_control_latest ON finance.production_control_version "
        "(control_key, recorded_at DESC)"
    )
    op.execute(
        "CREATE TRIGGER finance_production_control_append_only "
        "BEFORE UPDATE OR DELETE ON finance.production_control_version "
        "FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()"
    )
    op.execute(
        "CREATE TRIGGER finance_production_control_no_truncate "
        "BEFORE TRUNCATE ON finance.production_control_version "
        "FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_change()"
    )


def downgrade() -> None:
    raise RuntimeError("Finance production-control evidence requires a reviewed preservation plan")
