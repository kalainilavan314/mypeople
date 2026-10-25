"""Registration: the account's identity route and consent records

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-25

BRD v1.1 FR-AUTH-010 to 013, BR-003, BR-005 (NIC or passport, one route per
account), ENT-02 IdentityRecord.route and passport_country, ENT-05
ConsentRecord, BR-008 and FR-REG-003 (consent before any upload).

- identity.identity_record: the route an account registered with and, for
  passports, the issuing country. Members created by the Express sign-up
  have no row and are on the NIC route.
- membership.consent_record: each consent with the notice version shown
  and the time; withdrawing sets withdrawn_at.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE identity.identity_record (
            member_id        uuid PRIMARY KEY REFERENCES npm.member (id),
            route            text NOT NULL CHECK (route IN ('nic', 'passport')),
            passport_country text CHECK (passport_country ~ '^[A-Z]{3}$'),
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT identity_record_country CHECK ((route = 'passport') = (passport_country IS NOT NULL))
        )
        """
    )
    op.execute(
        """
        CREATE TABLE membership.consent_record (
            id             bigserial PRIMARY KEY,
            member_id      uuid NOT NULL REFERENCES npm.member (id),
            consent_type   text NOT NULL CHECK (consent_type IN ('terms_and_privacy', 'identity_review')),
            notice_version text NOT NULL,
            given_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            withdrawn_at   timestamptz
        )
        """
    )
    op.execute(
        "CREATE INDEX consent_record_member ON membership.consent_record (member_id, consent_type) "
        "WHERE withdrawn_at IS NULL"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE membership.consent_record")
    op.execute("DROP TABLE identity.identity_record")
