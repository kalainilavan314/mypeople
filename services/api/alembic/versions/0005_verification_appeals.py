"""Appeals against identity decisions

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-25

BRD v1.1 FR-IDV-013, PRM-29 idv.appeal.decide, M04 (member's appeal),
D05 (appeals queue), §15B.4: one appeal per Request-update or
Unable-to-verify decision, decided by someone other than the original
reviewer, with the outcome and a reason sent to the member.

identity.review_appeal: one row per appeal, with a VA reference as the
member's receipt. States: submitted, in_review (claimed by one person),
upheld, overturned. decision_id is unique, so a decision can be appealed
only once. Once upheld or overturned, the row can no longer be changed or
deleted.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE identity.appeal_ref_seq")
    op.execute(
        """
        CREATE TABLE identity.review_appeal (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            appeal_ref     text NOT NULL UNIQUE
                           DEFAULT 'VA-' || lpad(nextval('identity.appeal_ref_seq')::text, 5, '0'),
            decision_id    uuid NOT NULL UNIQUE REFERENCES identity.review_decision (id),
            review_id      uuid NOT NULL REFERENCES identity.identity_review (id),
            member_id      uuid NOT NULL REFERENCES npm.member (id),
            -- The review's area, so the queue can be limited to a decider's areas.
            area_path      text[] NOT NULL,
            statement      text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 1000),
            state          text NOT NULL DEFAULT 'submitted'
                           CHECK (state IN ('submitted', 'in_review', 'upheld', 'overturned')),
            submitted_at   timestamptz NOT NULL DEFAULT now(),
            claimed_by     uuid REFERENCES npm.member (id),
            claimed_at     timestamptz,
            decided_by     uuid REFERENCES npm.member (id),
            decider_tier   text,
            decided_at     timestamptz,
            outcome_reason text CHECK (char_length(outcome_reason) <= 1000),
            CONSTRAINT review_appeal_claim CHECK ((claimed_by IS NULL) = (claimed_at IS NULL)),
            CONSTRAINT review_appeal_in_review_claimed CHECK (state <> 'in_review' OR claimed_by IS NOT NULL),
            CONSTRAINT review_appeal_decided CHECK (
                (state IN ('upheld', 'overturned'))
                = (decided_by IS NOT NULL AND decider_tier IS NOT NULL AND decided_at IS NOT NULL
                   AND outcome_reason IS NOT NULL)
            )
        )
        """
    )
    op.execute("CREATE INDEX review_appeal_queue ON identity.review_appeal USING gin (area_path)")
    op.execute("CREATE INDEX review_appeal_review ON identity.review_appeal (review_id)")
    op.execute(
        """
        CREATE FUNCTION identity.refuse_change_after_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' OR OLD.state IN ('upheld', 'overturned') THEN
                RAISE EXCEPTION '%.%: a decided appeal cannot be changed or deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME;
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER review_appeal_keep_decisions BEFORE UPDATE OR DELETE ON identity.review_appeal "
        "FOR EACH ROW EXECUTE FUNCTION identity.refuse_change_after_decision()"
    )
    op.execute(
        "CREATE TRIGGER review_appeal_no_truncate BEFORE TRUNCATE ON identity.review_appeal "
        "FOR EACH STATEMENT EXECUTE FUNCTION identity.refuse_change()"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE identity.review_appeal")
    op.execute("DROP FUNCTION identity.refuse_change_after_decision()")
    op.execute("DROP SEQUENCE identity.appeal_ref_seq")
