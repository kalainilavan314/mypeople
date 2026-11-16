"""Add the Phase 1 policy decision register.

Revision ID: 0029
Revises: 0028
"""

from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ops.policy_decision_revision (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            decision_key text NOT NULL,
            revision integer NOT NULL CHECK (revision > 0),
            status text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
            decision_text text NOT NULL CHECK (char_length(decision_text) BETWEEN 10 AND 4000),
            rationale text NOT NULL CHECK (char_length(rationale) BETWEEN 10 AND 4000),
            effective_from date,
            created_by uuid NOT NULL REFERENCES npm.member(id),
            updated_by uuid NOT NULL REFERENCES npm.member(id),
            submitted_by uuid REFERENCES npm.member(id),
            created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            submitted_at timestamptz,
            resolved_at timestamptz,
            UNIQUE (decision_key, revision)
        );

        CREATE INDEX policy_decision_status
            ON ops.policy_decision_revision (status, decision_key);

        CREATE TABLE ops.policy_decision_review (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            revision_id uuid NOT NULL REFERENCES ops.policy_decision_revision(id),
            role text NOT NULL,
            outcome text NOT NULL CHECK (outcome IN ('approve', 'reject')),
            reviewer_name text NOT NULL CHECK (char_length(reviewer_name) BETWEEN 2 AND 200),
            reviewer_title text NOT NULL CHECK (char_length(reviewer_title) BETWEEN 2 AND 200),
            evidence_ref text NOT NULL CHECK (char_length(evidence_ref) BETWEEN 3 AND 300),
            comment text NOT NULL CHECK (char_length(comment) BETWEEN 10 AND 2000),
            reviewed_at date NOT NULL,
            recorded_by uuid NOT NULL REFERENCES npm.member(id),
            created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (revision_id, role)
        );

        CREATE FUNCTION ops.protect_policy_decision_revision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'policy decision revisions are append-only';
            END IF;
            IF OLD.status <> 'draft' AND (
                NEW.decision_key IS DISTINCT FROM OLD.decision_key OR
                NEW.revision IS DISTINCT FROM OLD.revision OR
                NEW.decision_text IS DISTINCT FROM OLD.decision_text OR
                NEW.rationale IS DISTINCT FROM OLD.rationale OR
                NEW.effective_from IS DISTINCT FROM OLD.effective_from
            ) THEN
                RAISE EXCEPTION 'submitted policy decision content is immutable';
            END IF;
            IF NOT (
                NEW.status = OLD.status OR
                (OLD.status = 'draft' AND NEW.status = 'in_review') OR
                (OLD.status = 'in_review' AND NEW.status IN ('approved', 'rejected'))
            ) THEN
                RAISE EXCEPTION 'invalid policy decision transition % -> %', OLD.status, NEW.status;
            END IF;
            RETURN NEW;
        END;
        $$;

        CREATE TRIGGER policy_decision_revision_protected
        BEFORE UPDATE OR DELETE ON ops.policy_decision_revision
        FOR EACH ROW EXECUTE FUNCTION ops.protect_policy_decision_revision();

        CREATE FUNCTION ops.reject_policy_decision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'policy decision evidence is append-only';
        END;
        $$;

        CREATE TRIGGER policy_decision_review_append_only
        BEFORE UPDATE OR DELETE ON ops.policy_decision_review
        FOR EACH ROW EXECUTE FUNCTION ops.reject_policy_decision_mutation();

        CREATE TRIGGER policy_decision_revision_no_truncate
        BEFORE TRUNCATE ON ops.policy_decision_revision
        FOR EACH STATEMENT EXECUTE FUNCTION ops.reject_policy_decision_mutation();

        CREATE TRIGGER policy_decision_review_no_truncate
        BEFORE TRUNCATE ON ops.policy_decision_review
        FOR EACH STATEMENT EXECUTE FUNCTION ops.reject_policy_decision_mutation();
        """
    )


def downgrade() -> None:
    raise RuntimeError("Policy decision evidence requires a reviewed preservation plan")
