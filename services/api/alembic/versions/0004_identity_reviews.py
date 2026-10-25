"""Identity reviews and immutable review decisions

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-25

BRD v1.1 §9.3 identity states, ENT-02 IdentityRecord (status, review_ref),
ENT-04 ReviewDecision, W01/W02 (FR-WEB-001 to 013), FR-REG-019 to 025,
BR-011 to BR-014, BR-080 to BR-086.

- identity.identity_review: one submission for team review, with its VR
  reference. States: submitted, in_review (claimed by one reviewer),
  needs_update, verified, unable_to_verify. A correction returns to the
  same review (FR-REG-023). area_path is the member's area when submitted,
  in the audit log's key form, so the queue can be limited to a
  reviewer's areas (FR-WEB-001).
- identity.review_decision: one row per decision, never changed or deleted
  (FR-WEB-011, BR-082): reviewer, their tier, time, decision, checklist,
  requested items, reason and the document versions decided on.

npm.member.verification_status (Express) is kept in step by the API, so the
live member app and the staff eligibility rule (BR-097) keep working.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE identity.review_ref_seq")
    op.execute(
        """
        CREATE TABLE identity.identity_review (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            review_ref    text NOT NULL UNIQUE
                          DEFAULT 'VR-' || lpad(nextval('identity.review_ref_seq')::text, 5, '0'),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            route         text NOT NULL CHECK (route IN ('nic', 'passport')),
            state         text NOT NULL DEFAULT 'submitted'
                          CHECK (state IN ('submitted', 'in_review', 'needs_update', 'verified', 'unable_to_verify')),
            area_path     text[] NOT NULL,
            submitted_at  timestamptz NOT NULL DEFAULT now(),
            -- When the member last sent it for review: the first submission or the latest correction.
            resubmitted_at timestamptz,
            claimed_by    uuid REFERENCES npm.member (id),
            claimed_at    timestamptz,
            decided_at    timestamptz,
            CONSTRAINT identity_review_claim CHECK ((claimed_by IS NULL) = (claimed_at IS NULL)),
            -- Only a claimed review is in review (FR-WEB-003).
            CONSTRAINT identity_review_in_review_claimed CHECK (state <> 'in_review' OR claimed_by IS NOT NULL),
            CONSTRAINT identity_review_decided
                CHECK ((state IN ('verified', 'unable_to_verify')) = (decided_at IS NOT NULL))
        )
        """
    )
    # One open review per member: a repeated submit cannot create a second (FR-REG-019).
    op.execute(
        "CREATE UNIQUE INDEX identity_review_open ON identity.identity_review (member_id) "
        "WHERE state IN ('submitted', 'in_review', 'needs_update')"
    )
    op.execute("CREATE INDEX identity_review_queue ON identity.identity_review USING gin (area_path)")

    op.execute(
        """
        CREATE TABLE identity.review_decision (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            review_id        uuid NOT NULL REFERENCES identity.identity_review (id),
            decision         text NOT NULL CHECK (decision IN ('approve', 'request_update', 'unable_to_verify')),
            reviewer_id      uuid NOT NULL REFERENCES npm.member (id),
            reviewer_tier    text NOT NULL,
            decided_at       timestamptz NOT NULL DEFAULT now(),
            checklist        text[] NOT NULL DEFAULT '{}',
            requested_items  text[] NOT NULL DEFAULT '{}',
            reason_category  text,
            note             text,
            -- The document ids and versions in front of the reviewer (BR-082).
            evidence         jsonb NOT NULL,
            CONSTRAINT review_decision_reason CHECK (decision = 'approve' OR reason_category IS NOT NULL),
            CONSTRAINT review_decision_items CHECK (decision <> 'request_update' OR cardinality(requested_items) > 0)
        )
        """
    )
    op.execute("CREATE INDEX review_decision_review ON identity.review_decision (review_id, decided_at)")
    op.execute(
        """
        CREATE FUNCTION identity.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION '%.% cannot be changed or deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME;
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER review_decision_no_update_or_delete BEFORE UPDATE OR DELETE ON identity.review_decision "
        "FOR EACH ROW EXECUTE FUNCTION identity.refuse_change()"
    )
    op.execute(
        "CREATE TRIGGER review_decision_no_truncate BEFORE TRUNCATE ON identity.review_decision "
        "FOR EACH STATEMENT EXECUTE FUNCTION identity.refuse_change()"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP TABLE identity.review_decision")
    op.execute("DROP FUNCTION identity.refuse_change()")
    op.execute("DROP TABLE identity.identity_review")
    op.execute("DROP SEQUENCE identity.review_ref_seq")
