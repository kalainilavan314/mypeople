"""Private bank-transfer contribution records; no live intake routes.

Revision ID: 0022
Revises: 0021

MP-DEC-001 M1.4: a submission reference is not an official receipt. Finance
events and receipt numbers are never overwritten or reused.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA finance")
    op.execute(
        """
        CREATE TABLE finance.contribution (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id uuid NOT NULL REFERENCES npm.member(id),
            contribution_ref text NOT NULL UNIQUE CHECK (contribution_ref ~ '^MP-[0-9A-F]{8}$'),
            amount_minor bigint NOT NULL CHECK (amount_minor > 0),
            currency char(3) NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
            transfer_date date NOT NULL,
            bank_reference text NOT NULL CHECK (char_length(bank_reference) BETWEEN 1 AND 120),
            status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
                'SUBMITTED', 'PENDING_REVIEW', 'RECONCILED', 'APPROVAL_PENDING',
                'VERIFIED', 'NEEDS_CORRECTION', 'REJECTED', 'ON_HOLD', 'REFUNDED'
            )),
            idempotency_key uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (member_id, idempotency_key)
        )
        """
    )
    op.execute("CREATE INDEX contribution_member_created ON finance.contribution (member_id, created_at DESC)")
    op.execute("CREATE INDEX contribution_status_created ON finance.contribution (status, created_at)")
    op.execute(
        """
        CREATE TABLE finance.contribution_slip (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            contribution_id uuid NOT NULL UNIQUE REFERENCES finance.contribution(id),
            -- Ciphertext only. The separate finance key must never be stored here.
            encrypted_image bytea NOT NULL,
            key_id text NOT NULL,
            content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
            sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
            uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE finance.reconciliation (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            contribution_id uuid NOT NULL UNIQUE REFERENCES finance.contribution(id),
            statement_reference text NOT NULL CHECK (char_length(statement_reference) BETWEEN 1 AND 120),
            reviewed_by uuid NOT NULL REFERENCES npm.member(id),
            reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE finance.approval (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            contribution_id uuid NOT NULL UNIQUE REFERENCES finance.contribution(id),
            approved_by uuid NOT NULL REFERENCES npm.member(id),
            approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE finance.receipt_counter (
            singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
            last_number integer NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 99999)
        )
        """
    )
    op.execute("INSERT INTO finance.receipt_counter (singleton, last_number) VALUES (true, 0)")
    op.execute(
        """
        CREATE TABLE finance.receipt (
            number integer PRIMARY KEY CHECK (number BETWEEN 1 AND 99999),
            contribution_id uuid NOT NULL UNIQUE REFERENCES finance.contribution(id),
            issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            voided_at timestamptz,
            void_reason text CHECK (void_reason IS NULL OR char_length(void_reason) BETWEEN 3 AND 1000),
            CONSTRAINT receipt_void_pair CHECK ((voided_at IS NULL) = (void_reason IS NULL))
        )
        """
    )
    op.execute(
        """
        CREATE TABLE finance.contribution_event (
            id bigserial PRIMARY KEY,
            contribution_id uuid NOT NULL REFERENCES finance.contribution(id),
            from_status text,
            to_status text NOT NULL,
            actor_id uuid REFERENCES npm.member(id),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
            occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX contribution_event_history ON finance.contribution_event (contribution_id, id)")
    for table in ("contribution_event", "reconciliation", "approval"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON finance.{table} "
            "FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()"
        )


def downgrade() -> None:
    raise RuntimeError("Finance records require a reviewed preservation and migration plan; automatic downgrade is refused")
