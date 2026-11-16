"""Finance workflow, correction slip versions, declarations, and risk flags.

Revision ID: 0027
Revises: 0026

M1.4: Extends the private finance domain with DRAFT contributions, versioned
immutable slip evidence for corrections, reviewer assignment, member declarations,
related-party conflict tracking, and operational queue indexes.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Update contribution status constraint to include DRAFT
    op.execute(
        """
        ALTER TABLE finance.contribution
            DROP CONSTRAINT IF EXISTS contribution_status_check;

        ALTER TABLE finance.contribution
            ADD CONSTRAINT contribution_status_check CHECK (status IN (
                'DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'RECONCILED', 'APPROVAL_PENDING',
                'VERIFIED', 'NEEDS_CORRECTION', 'REJECTED', 'ON_HOLD', 'REFUNDED'
            ));

        ALTER TABLE finance.contribution
            ALTER COLUMN status SET DEFAULT 'DRAFT';
        """
    )

    # 2. Add reviewer claim, risk flags, and member declarations to contribution
    op.execute(
        """
        ALTER TABLE finance.contribution
            ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES npm.member(id),
            ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
            ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS declaration_version text NOT NULL DEFAULT 'v1',
            ADD COLUMN IF NOT EXISTS no_privilege_acknowledged boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS information_accurate_acknowledged boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS paying_for_self boolean NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS current_slip_id uuid;
        """
    )

    # 3. Allow multiple versioned slips per contribution for corrections
    op.execute(
        """
        ALTER TABLE finance.contribution_slip
            DROP CONSTRAINT IF EXISTS contribution_slip_contribution_id_key;

        ALTER TABLE finance.contribution_slip
            ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

        ALTER TABLE finance.contribution_slip
            DROP CONSTRAINT IF EXISTS contribution_slip_version_unique;

        ALTER TABLE finance.contribution_slip
            ADD CONSTRAINT contribution_slip_version_unique UNIQUE (contribution_id, version);

        ALTER TABLE finance.contribution
            DROP CONSTRAINT IF EXISTS contribution_current_slip_fkey;

        ALTER TABLE finance.contribution
            ADD CONSTRAINT contribution_current_slip_fkey
            FOREIGN KEY (current_slip_id) REFERENCES finance.contribution_slip(id);
        """
    )

    # 4. Enforce append-only on contribution_slip
    op.execute(
        """
        DROP TRIGGER IF EXISTS contribution_slip_append_only ON finance.contribution_slip;
        CREATE TRIGGER contribution_slip_append_only BEFORE UPDATE OR DELETE ON finance.contribution_slip
            FOR EACH ROW EXECUTE FUNCTION ops.refuse_change();
        """
    )

    # 5. Add related party conflict indicator to approval
    op.execute(
        """
        ALTER TABLE finance.approval
            ADD COLUMN IF NOT EXISTS related_party_conflict boolean NOT NULL DEFAULT false;
        """
    )

    # 6. Operational queue and reference indexes
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS contribution_status_transfer_date
            ON finance.contribution (status, transfer_date DESC);

        CREATE INDEX IF NOT EXISTS contribution_bank_reference_search
            ON finance.contribution (bank_reference);

        CREATE INDEX IF NOT EXISTS contribution_claimed_by
            ON finance.contribution (claimed_by) WHERE claimed_by IS NOT NULL;
        """
    )


def downgrade() -> None:
    raise RuntimeError(
        "Finance records require a reviewed preservation and migration plan; automatic downgrade is refused"
    )
