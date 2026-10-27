"""Refresh tokens, security alerts, quarterly access reviews

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-27

BRD v1.1 FR-AUTH-018, FR-AUTH-025, FR-AUTH-027, NFR-SEC-12, NFR-SEC-13,
BR-084, BR-151, ENT-68, KPI-42.

- identity.session: the hash of the session's current refresh token and of
  the one before it, so a refresh token is good once and a stolen, already
  used one is noticed (FR-AUTH-025). Two new reasons a session can end:
  refresh_reuse and not_me.
- identity.security_alert (ENT-68): a sign-in the risk rules flagged, or a
  reused refresh token, with its signals and the member's answer ("it was
  me", or "this wasn't me", which secures the account).
- access.assignment_review: every quarterly confirmation or revocation of a
  staff grant, append-only (FR-AUTH-027, KPI-42).
- Every active staff grant except Tier 5 becomes due for review by the end of
  the next quarter, Sri Lankan time, unless it was due sooner (FR-AUTH-027
  replaces RB-05's 12 months for explicit grants only).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE identity.session
            ADD COLUMN refresh_hash text,
            ADD COLUMN previous_refresh_hash text,
            ADD COLUMN refreshed_at timestamptz,
            DROP CONSTRAINT session_revoked_reason_check,
            ADD CONSTRAINT session_revoked_reason_check CHECK (
                revoked_reason IN ('member', 'idle', 'mfa_failures', 'password_reset', 'refresh_reuse', 'not_me')
            )
        """
    )
    op.execute("CREATE UNIQUE INDEX session_refresh_hash ON identity.session (refresh_hash) WHERE refresh_hash IS NOT NULL")

    op.execute(
        """
        CREATE TABLE identity.security_alert (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            session_id      uuid REFERENCES identity.session (id),
            kind            text NOT NULL CHECK (kind IN ('suspicious_sign_in', 'refresh_reuse')),
            -- The rules that fired, e.g. {new_device, recent_failures}; never an address or a location.
            signals         text[] NOT NULL,
            device_label    text NOT NULL CHECK (char_length(device_label) <= 60),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            answered_at     timestamptz,
            answer          text CHECK (answer IN ('it_was_me', 'not_me')),
            CONSTRAINT security_alert_answer CHECK ((answered_at IS NULL) = (answer IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX security_alert_member ON identity.security_alert (member_id, created_at DESC)")

    op.execute(
        """
        CREATE TABLE access.assignment_review (
            id             bigserial PRIMARY KEY,
            assignment_id  uuid NOT NULL REFERENCES access.staff_assignment (id),
            quarter        text NOT NULL CHECK (quarter ~ '^[0-9]{4}-Q[1-4]$'),
            decision       text NOT NULL CHECK (decision IN ('confirmed', 'revoked')),
            reason         text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
            reviewed_by    uuid NOT NULL REFERENCES npm.member (id),
            reviewed_at    timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX assignment_review_assignment ON access.assignment_review (assignment_id, reviewed_at DESC)")
    # LEAST ignores NULL, so a grant that had no review date gets one.
    op.execute(
        """
        UPDATE access.staff_assignment
        SET review_due_at = LEAST(
            review_due_at,
            (date_trunc('quarter', now() AT TIME ZONE 'Asia/Colombo') + interval '6 months') AT TIME ZONE 'Asia/Colombo'
        )
        WHERE state = 'active' AND tier <> '5'
        """
    )
    op.execute(
        """
        CREATE TRIGGER assignment_review_append_only BEFORE UPDATE OR DELETE ON access.assignment_review
        FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()
        """
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    # Review dates set by the upgrade are left as they are.
    op.execute("DROP TABLE access.assignment_review")
    op.execute("DROP TABLE identity.security_alert")
    op.execute("DROP INDEX identity.session_refresh_hash")
    op.execute(
        """
        UPDATE identity.session SET revoked_reason = 'member' WHERE revoked_reason IN ('refresh_reuse', 'not_me');
        ALTER TABLE identity.session
            DROP CONSTRAINT session_revoked_reason_check,
            ADD CONSTRAINT session_revoked_reason_check CHECK (
                revoked_reason IN ('member', 'idle', 'mfa_failures', 'password_reset')
            ),
            DROP COLUMN refreshed_at,
            DROP COLUMN previous_refresh_hash,
            DROP COLUMN refresh_hash
        """
    )
