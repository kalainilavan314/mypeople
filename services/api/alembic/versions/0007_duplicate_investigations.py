"""Duplicate identity investigations

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-25

BRD v1.1 FR-IDV-010, FR-WEB-012, BR-007, BR-094, PRM-28, D04: evidence that
one person holds two accounts opens an investigation; neither account is
merged, suspended or rejected until a person decides.

identity.duplicate_case: one investigation of two accounts (member_a is the
smaller id, so a pair has one case at most). signal says why it opened:
profile_match (the same name and date of birth, found when a review is
submitted) or reported (a reviewer opened it). States: open, in_review
(claimed), not_duplicate, duplicate_confirmed. A decided case cannot be
changed or deleted.

Equal NIC hashes and phone numbers cannot occur between active members:
the Express migrations already make both unique (BR-007 at sign-up).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE identity.duplicate_ref_seq")
    op.execute(
        """
        CREATE TABLE identity.duplicate_case (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_ref       text NOT NULL UNIQUE
                           DEFAULT 'DC-' || lpad(nextval('identity.duplicate_ref_seq')::text, 5, '0'),
            member_a       uuid NOT NULL REFERENCES npm.member (id),
            member_b       uuid NOT NULL REFERENCES npm.member (id),
            signal         text NOT NULL CHECK (signal IN ('profile_match', 'reported')),
            opened_by      uuid REFERENCES npm.member (id),
            opened_reason  text CHECK (char_length(opened_reason) <= 1000),
            -- Both members' areas, so either area's investigators see the case.
            area_path      text[] NOT NULL,
            state          text NOT NULL DEFAULT 'open'
                           CHECK (state IN ('open', 'in_review', 'not_duplicate', 'duplicate_confirmed')),
            opened_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            claimed_by     uuid REFERENCES npm.member (id),
            claimed_at     timestamptz,
            decided_by     uuid REFERENCES npm.member (id),
            decided_at     timestamptz,
            outcome_reason text CHECK (char_length(outcome_reason) <= 1000),
            CONSTRAINT duplicate_case_pair UNIQUE (member_a, member_b),
            CONSTRAINT duplicate_case_ordered CHECK (member_a < member_b),
            -- A reviewer's report says why; an automatic signal has no opener.
            CONSTRAINT duplicate_case_opener CHECK ((signal = 'reported') = (opened_by IS NOT NULL AND opened_reason IS NOT NULL)),
            CONSTRAINT duplicate_case_claim CHECK ((claimed_by IS NULL) = (claimed_at IS NULL)),
            CONSTRAINT duplicate_case_in_review_claimed CHECK (state <> 'in_review' OR claimed_by IS NOT NULL),
            CONSTRAINT duplicate_case_decided CHECK (
                (state IN ('not_duplicate', 'duplicate_confirmed'))
                = (decided_by IS NOT NULL AND decided_at IS NOT NULL AND outcome_reason IS NOT NULL)
            )
        )
        """
    )
    op.execute("CREATE INDEX duplicate_case_queue ON identity.duplicate_case USING gin (area_path)")
    op.execute("CREATE INDEX duplicate_case_member_b ON identity.duplicate_case (member_b)")
    op.execute(
        """
        CREATE FUNCTION identity.refuse_duplicate_change_after_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' OR OLD.state IN ('not_duplicate', 'duplicate_confirmed') THEN
                RAISE EXCEPTION 'identity.duplicate_case: a decided case cannot be changed or deleted';
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER duplicate_case_keep_decisions BEFORE UPDATE OR DELETE ON identity.duplicate_case "
        "FOR EACH ROW EXECUTE FUNCTION identity.refuse_duplicate_change_after_decision()"
    )
    op.execute(
        "CREATE TRIGGER duplicate_case_no_truncate BEFORE TRUNCATE ON identity.duplicate_case "
        "FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_change()"
    )
    # Finds members with the same name and date of birth when a review is submitted.
    op.execute(
        "CREATE INDEX member_name_dob ON npm.member (lower(regexp_replace(trim(full_name), '\\s+', ' ', 'g')), dob) "
        "WHERE deleted_at IS NULL AND dob IS NOT NULL"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP INDEX npm.member_name_dob")
    op.execute("DROP TABLE identity.duplicate_case")
    op.execute("DROP FUNCTION identity.refuse_duplicate_change_after_decision()")
    op.execute("DROP SEQUENCE identity.duplicate_ref_seq")
