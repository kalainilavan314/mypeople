"""Authenticator lockout counted per factor, not per session

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-25

BRD v1.1 NFR-SEC-04, FR-STF-001 (staff MFA) and the review finding of
25 October 2026: wrong authenticator codes were counted per session, so
signing in again started a fresh count and the six-digit code could be
guessed across many sessions.

- failed_attempts: wrong codes since the last correct code or lockout,
  across every session of the member.
- locked_until: no code is checked before this time.
- lockouts: how many lockouts in a row, so each one lasts longer. A correct
  code resets it.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE identity.mfa_factor
            ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
            ADD COLUMN locked_until    timestamptz,
            ADD COLUMN lockouts        integer NOT NULL DEFAULT 0 CHECK (lockouts >= 0)
        """
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute(
        "ALTER TABLE identity.mfa_factor DROP COLUMN lockouts, DROP COLUMN locked_until, DROP COLUMN failed_attempts"
    )
