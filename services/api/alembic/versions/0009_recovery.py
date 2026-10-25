"""Recovery contacts and assisted recovery requests

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-25

BRD v1.1 FR-REG-028 (a mobile number confirmed by one-time code before it
becomes the recovery contact), FR-AUTH-014 to 017, FR-AUTH-023, FR-AUTH-026,
BR-023, BR-024.

- identity.recovery_contact: the member's confirmed recovery number, who
  confirmed it (the member by code, or a support reviewer after assisted
  recovery) and when it last changed. One-time codes themselves use the
  Express table npm.otp, hashed the same way, so both APIs share limits.
- identity.assisted_recovery: requests from people who cannot use their
  recovery contact, each with an AR reference. The ID number is matched
  to an account but never stored; contact details are kept only for the
  support team to reply.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE identity.recovery_contact (
            member_id    uuid PRIMARY KEY REFERENCES npm.member (id),
            phone        text NOT NULL UNIQUE CHECK (phone ~ '^\\+[1-9][0-9]{7,14}$'),
            confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            -- NULL when the member confirmed it with a code; a reviewer when support replaced it.
            confirmed_by uuid REFERENCES npm.member (id),
            -- FR-AUTH-023: high-risk actions wait 24 hours after a change.
            changed_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE SEQUENCE identity.recovery_ref_seq")
    op.execute(
        """
        CREATE TABLE identity.assisted_recovery (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            reference      text NOT NULL UNIQUE
                           DEFAULT 'AR-' || lpad(nextval('identity.recovery_ref_seq')::text, 5, '0'),
            member_id      uuid REFERENCES npm.member (id),
            contact_method text NOT NULL CHECK (contact_method IN ('phone', 'email', 'in_person')),
            contact_value  text CHECK (char_length(contact_value) <= 200),
            message        text CHECK (char_length(message) <= 500),
            area_path      text[] NOT NULL,
            state          text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'contact_replaced', 'declined')),
            requested_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            ip             text,
            resolved_by    uuid REFERENCES npm.member (id),
            resolved_at    timestamptz,
            outcome_note   text CHECK (char_length(outcome_note) <= 500),
            CONSTRAINT assisted_recovery_resolved
                CHECK ((state = 'open') = (resolved_by IS NULL AND resolved_at IS NULL AND outcome_note IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX assisted_recovery_queue ON identity.assisted_recovery USING gin (area_path)")
    op.execute("CREATE INDEX assisted_recovery_ip ON identity.assisted_recovery (ip, requested_at)")


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE identity.assisted_recovery")
    op.execute("DROP SEQUENCE identity.recovery_ref_seq")
    op.execute("DROP TABLE identity.recovery_contact")
