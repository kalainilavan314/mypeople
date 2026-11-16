"""Community ideas, surveys and development proposals (BRD v1.1 FR-IDEA-001 to 004, FR-SRV-001 to 006,
FR-DEV-001 to 008; screens H13, H14, H21, M15 to M17, D15).

Revision ID: 0035
Revises: 0034

- community.idea and idea_support: short local ideas, moderated before they are shown, with one
  support per member that never changes an idea's status (BR-044).
- community.survey, survey_question, survey_participation and survey_response: surveys for a
  target area, one response per member. A survey marked anonymous stores its answers with no link
  to the member: participation (who has answered) and responses (what was answered) are separate
  rows with nothing joining them (FR-SRV-003, OD-21).
- community.proposal and its append-only proposal_event history: structured development proposals
  moderated before publication and moved through review, approval for planning, funding identified
  and implementation by the tier holding that authority (FR-DEV-003, 006, BR-109).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROPOSAL_CATEGORIES = (
    "('roads_transport', 'agriculture', 'fisheries', 'employment', 'education', 'drinking_water', 'healthcare',"
    " 'environment', 'waste_management', 'tourism_enterprise', 'digital_literacy', 'youth_skills', 'other')"
)
PROPOSAL_STAGES = (
    "('pending_moderation', 'rejected', 'review', 'approved_for_planning', 'funding_identified', 'implementation',"
    " 'not_taken_forward', 'withdrawn')"
)


def upgrade() -> None:
    # --- Ideas (H13) ---------------------------------------------------------------------------------
    op.execute("CREATE SEQUENCE community.idea_number_seq")
    op.execute(
        """
        CREATE TABLE community.idea (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            idea_ref           text NOT NULL UNIQUE DEFAULT ('ID-' || lpad(nextval('community.idea_number_seq')::text, 5, '0')),
            author_id          uuid NOT NULL REFERENCES npm.member (id),
            title              text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 80),
            benefit            text NOT NULL CHECK (char_length(benefit) BETWEEN 10 AND 1000),
            area_key           text NOT NULL,
            area_path          text[] NOT NULL,
            state              text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published', 'rejected', 'withdrawn')),
            moderation_reason  text CHECK (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 3 AND 500),
            moderated_by       uuid REFERENCES npm.member (id),
            moderated_at       timestamptz,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT idea_rejection_reason CHECK (state <> 'rejected' OR moderation_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX idea_area ON community.idea USING gin (area_path)")
    op.execute("CREATE INDEX idea_author ON community.idea (author_id, created_at DESC)")
    op.execute("CREATE INDEX idea_pending ON community.idea (created_at) WHERE state = 'pending'")
    op.execute(
        """
        CREATE TABLE community.idea_support (
            idea_id     uuid NOT NULL REFERENCES community.idea (id),
            member_id   uuid NOT NULL REFERENCES npm.member (id),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (idea_id, member_id)
        )
        """
    )

    # --- Surveys (H14, H21) --------------------------------------------------------------------------
    op.execute("CREATE SEQUENCE community.survey_number_seq")
    op.execute(
        """
        CREATE TABLE community.survey (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            survey_ref      text NOT NULL UNIQUE DEFAULT ('SV-' || lpad(nextval('community.survey_number_seq')::text, 4, '0')),
            title_en        text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 120),
            title_ta        text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 160),
            audience_en     text NOT NULL CHECK (char_length(audience_en) BETWEEN 3 AND 300),
            audience_ta     text NOT NULL CHECK (char_length(audience_ta) BETWEEN 3 AND 400),
            privacy_en      text NOT NULL CHECK (char_length(privacy_en) BETWEEN 10 AND 1000),
            privacy_ta      text NOT NULL CHECK (char_length(privacy_ta) BETWEEN 10 AND 1500),
            next_steps_en   text NOT NULL CHECK (char_length(next_steps_en) BETWEEN 10 AND 1000),
            next_steps_ta   text NOT NULL CHECK (char_length(next_steps_ta) BETWEEN 10 AND 1500),
            anonymous       boolean NOT NULL DEFAULT false,
            allow_edits     boolean NOT NULL DEFAULT false,
            area_key        text NOT NULL,
            area_path       text[] NOT NULL,
            state           text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'open', 'closed')),
            closes_at       timestamptz,
            created_by      uuid NOT NULL REFERENCES npm.member (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            -- An anonymous survey cannot be edited later: that would need a link back to the member.
            CONSTRAINT anonymous_no_edits CHECK (NOT (anonymous AND allow_edits))
        )
        """
    )
    op.execute("CREATE INDEX survey_area ON community.survey USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE community.survey_question (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            survey_id   uuid NOT NULL REFERENCES community.survey (id) ON DELETE CASCADE,
            position    integer NOT NULL CHECK (position BETWEEN 1 AND 50),
            kind        text NOT NULL CHECK (kind IN ('single', 'multiple', 'scale', 'text')),
            prompt_en   text NOT NULL CHECK (char_length(prompt_en) BETWEEN 3 AND 300),
            prompt_ta   text NOT NULL CHECK (char_length(prompt_ta) BETWEEN 3 AND 400),
            options     jsonb NOT NULL DEFAULT '[]'::jsonb,
            sensitive   boolean NOT NULL DEFAULT false,
            required    boolean NOT NULL DEFAULT true,
            UNIQUE (survey_id, position)
        )
        """
    )
    op.execute("CREATE SEQUENCE community.survey_receipt_seq")
    op.execute(
        """
        CREATE TABLE community.survey_participation (
            survey_id     uuid NOT NULL REFERENCES community.survey (id),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            receipt_ref   text NOT NULL UNIQUE DEFAULT ('SR-' || lpad(nextval('community.survey_receipt_seq')::text, 6, '0')),
            submitted_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (survey_id, member_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE community.survey_response (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            survey_id     uuid NOT NULL REFERENCES community.survey (id),
            -- NULL for an anonymous survey: nothing ties the answers to the member.
            member_id     uuid REFERENCES npm.member (id),
            answers       jsonb NOT NULL,
            submitted_at  date NOT NULL DEFAULT CURRENT_DATE,
            UNIQUE (survey_id, member_id)
        )
        """
    )
    op.execute("CREATE INDEX survey_response_survey ON community.survey_response (survey_id)")

    # --- Development proposals (M15 to M17, D15) ----------------------------------------------------------
    op.execute("CREATE SEQUENCE community.proposal_number_seq")
    op.execute(
        f"""
        CREATE TABLE community.proposal (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            proposal_ref     text NOT NULL UNIQUE DEFAULT ('DP-' || lpad(nextval('community.proposal_number_seq')::text, 5, '0')),
            author_id        uuid NOT NULL REFERENCES npm.member (id),
            client_reference uuid NOT NULL,
            title            text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
            category         text NOT NULL CHECK (category IN {PROPOSAL_CATEGORIES}),
            area_key         text NOT NULL,
            area_path        text[] NOT NULL,
            problem          text NOT NULL CHECK (char_length(problem) BETWEEN 20 AND 3000),
            solution         text NOT NULL CHECK (char_length(solution) BETWEEN 20 AND 3000),
            benefit          text NOT NULL CHECK (char_length(benefit) BETWEEN 10 AND 2000),
            cost_estimate    numeric(14, 2) CHECK (cost_estimate IS NULL OR cost_estimate >= 0),
            evidence         text CHECK (evidence IS NULL OR char_length(evidence) <= 2000),
            stage            text NOT NULL DEFAULT 'pending_moderation' CHECK (stage IN {PROPOSAL_STAGES}),
            stage_reason     text,
            next_step_en     text,
            next_step_ta     text,
            revision         integer NOT NULL DEFAULT 1,
            published_at     timestamptz,
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT proposal_one_per_draft UNIQUE (author_id, client_reference),
            CONSTRAINT proposal_rejection_reason CHECK (stage NOT IN ('rejected', 'not_taken_forward') OR stage_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX proposal_area ON community.proposal USING gin (area_path)")
    op.execute("CREATE INDEX proposal_author ON community.proposal (author_id, created_at DESC)")
    op.execute("CREATE INDEX proposal_stage ON community.proposal (stage, updated_at)")
    op.execute(
        f"""
        CREATE TABLE community.proposal_event (
            id           bigserial PRIMARY KEY,
            proposal_id  uuid NOT NULL REFERENCES community.proposal (id),
            from_stage   text CHECK (from_stage IS NULL OR from_stage IN {PROPOSAL_STAGES}),
            to_stage     text NOT NULL CHECK (to_stage IN {PROPOSAL_STAGES}),
            actor_id     uuid NOT NULL REFERENCES npm.member (id),
            actor_tier   text,
            reason       text CHECK (reason IS NULL OR char_length(reason) <= 2000),
            occurred_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX proposal_event_proposal ON community.proposal_event (proposal_id, id)")
    op.execute(
        """
        CREATE TRIGGER proposal_event_append_only BEFORE UPDATE OR DELETE ON community.proposal_event
        FOR EACH ROW EXECUTE FUNCTION community.refuse_history_change()
        """
    )


def downgrade() -> None:
    for table in (
        "proposal_event", "proposal", "survey_response", "survey_participation", "survey_question", "survey",
        "idea_support", "idea",
    ):
        op.execute(f"DROP TABLE community.{table}")
    for sequence in ("proposal_number_seq", "survey_receipt_seq", "survey_number_seq", "idea_number_seq"):
        op.execute(f"DROP SEQUENCE community.{sequence}")
