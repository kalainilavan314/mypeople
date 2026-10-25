"""Session registry and staff multi-factor authentication

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-25

BRD v1.1 FR-AUTH-019 to 021, FR-AUTH-025, NFR-SEC-11 (members see and end
their sessions; revocation within 60 seconds; idle sessions expire),
FR-STF-001 and NFR-SEC-04 (staff use MFA: TOTP or a passkey).

- identity.session: one row per signed-in device. Tokens issued by this API
  name their session, so one can be ended alone and an idle one expires.
  mfa_verified_at records that the second factor was given in this session.
- identity.mfa_factor: a member's authenticator (TOTP) secret, encrypted;
  enabled_at is NULL until the first code confirms the enrolment.
  last_used_step stops a code being used twice.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE identity.session (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            -- A coarse label for the member's list (FR-AUTH-020): never a precise location.
            device_label    text NOT NULL CHECK (char_length(device_label) <= 60),
            -- A hash identifying the device, to notice a sign-in from a new one (FR-AUTH-019).
            device_key      text NOT NULL,
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            last_seen_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            mfa_verified_at timestamptz,
            mfa_failures    integer NOT NULL DEFAULT 0,
            revoked_at      timestamptz,
            revoked_reason  text CHECK (revoked_reason IN ('member', 'idle', 'mfa_failures', 'password_reset')),
            CONSTRAINT session_revoked CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX session_member_active ON identity.session (member_id) WHERE revoked_at IS NULL")
    op.execute("CREATE INDEX session_member_device ON identity.session (member_id, device_key)")
    op.execute(
        """
        CREATE TABLE identity.mfa_factor (
            member_id      uuid PRIMARY KEY REFERENCES npm.member (id),
            kind           text NOT NULL CHECK (kind = 'totp'),
            secret_sealed  bytea NOT NULL,
            created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            enabled_at     timestamptz,
            last_used_step bigint
        )
        """
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE identity.mfa_factor")
    op.execute("DROP TABLE identity.session")
