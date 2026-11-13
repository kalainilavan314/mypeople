"""The applicant consents to each partner referral (MP-FEA-002 M12, FR-AST-004).

Revision ID: 0043
Revises: 0042

A caseworker proposes a referral with its purpose; nothing is shared with the partner until consent is
recorded. A member gives or refuses that consent in the app; for a request from the hotline or the
public form, the caseworker records the consent the applicant gave them. Existing referrals keep
their recorded consent.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0043"
down_revision: str | None = "0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE assistance.referral ALTER COLUMN consent_at DROP NOT NULL")
    op.execute("ALTER TABLE assistance.referral DROP CONSTRAINT referral_state_check")
    op.execute(
        "ALTER TABLE assistance.referral ADD CONSTRAINT referral_state_check CHECK (state IN "
        "('proposed', 'consent_declined', 'sent', 'accepted', 'completed', 'declined'))"
    )
    # Nothing goes to a partner without consent: only a proposal, or one the applicant refused, lacks it.
    op.execute(
        "ALTER TABLE assistance.referral ADD CONSTRAINT referral_consent_before_sharing "
        "CHECK (consent_at IS NOT NULL OR state IN ('proposed', 'consent_declined'))"
    )
    op.execute(
        "ALTER TABLE assistance.referral ADD COLUMN purpose text "
        "CHECK (purpose IS NULL OR char_length(purpose) BETWEEN 3 AND 500)"
    )
    op.execute(
        "ALTER TABLE assistance.referral ADD COLUMN consent_recorded_by text "
        "CHECK (consent_recorded_by IS NULL OR consent_recorded_by IN ('applicant', 'caseworker'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE assistance.referral DROP COLUMN consent_recorded_by")
    op.execute("ALTER TABLE assistance.referral DROP COLUMN purpose")
    op.execute("ALTER TABLE assistance.referral DROP CONSTRAINT referral_consent_before_sharing")
    op.execute("ALTER TABLE assistance.referral DROP CONSTRAINT referral_state_check")
    op.execute(
        "ALTER TABLE assistance.referral ADD CONSTRAINT referral_state_check CHECK (state IN "
        "('sent', 'accepted', 'completed', 'declined'))"
    )
    op.execute("ALTER TABLE assistance.referral ALTER COLUMN consent_at SET NOT NULL")
