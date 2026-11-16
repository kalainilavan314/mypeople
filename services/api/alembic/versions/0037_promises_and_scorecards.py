"""Promise Tracker and the public accountability scorecard (BRD v1.1 FR-PRM-001 to 010, FR-ACS-001 to 008;
screens M18 to M20, D16, D17).

Revision ID: 0037
Revises: 0036

- community.promise with milestones: every published promise has a source, a responsible office,
  a measurable target, a due date and one of six statuses (BR-111, BR-112), labelled a party
  commitment or a government responsibility (BR-113).
- community.promise_update: dated updates with evidence, append-only; a correction is a new row
  pointing at the one it corrects, so both stay visible (BR-114). Publication and every status
  change wait for a second authorised person (FR-PRM-003).
- community.promise_feedback: moderated public feedback and the responsible office's reply.
- community.scorecard: computed area figures per quarter, shared with the responsible tiers for 10
  working days before publication, published in versions; corrections append a new version
  (FR-ACS-005, 006). community.scorecard_correction records requests and decisions.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0037"
down_revision: str | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = "('not_started', 'in_progress', 'completed', 'delayed', 'blocked', 'withdrawn')"
THEMES = (
    "('roads_transport', 'drinking_water', 'health', 'education', 'employment', 'agriculture', 'fisheries', 'housing',"
    " 'environment', 'governance', 'other')"
)


def upgrade() -> None:
    op.execute("CREATE SEQUENCE community.promise_number_seq")
    op.execute(
        f"""
        CREATE TABLE community.promise (
            id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            promise_ref           text NOT NULL UNIQUE DEFAULT ('PR-' || lpad(nextval('community.promise_number_seq')::text, 4, '0')),
            title_en              text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 160),
            title_ta              text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 220),
            description_en        text NOT NULL CHECK (char_length(description_en) BETWEEN 10 AND 3000),
            description_ta        text NOT NULL CHECK (char_length(description_ta) BETWEEN 10 AND 4500),
            source_reference      text NOT NULL CHECK (char_length(source_reference) BETWEEN 3 AND 500),
            source_published_on   date NOT NULL,
            office_en             text NOT NULL CHECK (char_length(office_en) BETWEEN 3 AND 200),
            office_ta             text NOT NULL CHECK (char_length(office_ta) BETWEEN 3 AND 300),
            kind                  text NOT NULL CHECK (kind IN ('party_commitment', 'government_responsibility')),
            theme                 text NOT NULL CHECK (theme IN {THEMES}),
            area_key              text NOT NULL,
            area_path             text[] NOT NULL,
            planned_start         date NOT NULL,
            due_date              date NOT NULL,
            target_en             text NOT NULL CHECK (char_length(target_en) BETWEEN 5 AND 1000),
            target_ta             text NOT NULL CHECK (char_length(target_ta) BETWEEN 5 AND 1500),
            blockers_en           text,
            blockers_ta           text,
            status                text NOT NULL DEFAULT 'not_started' CHECK (status IN {STATUSES}),
            status_reason         text,
            publication           text NOT NULL DEFAULT 'draft' CHECK (publication IN ('draft', 'awaiting_approval', 'published')),
            drafted_by            uuid NOT NULL REFERENCES npm.member (id),
            publication_requested_by uuid REFERENCES npm.member (id),
            published_by          uuid REFERENCES npm.member (id),
            published_at          timestamptz,
            last_verified_at      timestamptz,
            update_due_at         timestamptz,
            created_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT promise_dates CHECK (due_date >= planned_start),
            CONSTRAINT promise_publisher_not_drafter CHECK (published_by IS NULL OR published_by <> publication_requested_by),
            CONSTRAINT promise_withdrawn_reason CHECK (status <> 'withdrawn' OR status_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX promise_area ON community.promise USING gin (area_path)")
    op.execute("CREATE INDEX promise_published ON community.promise (status, due_date) WHERE publication = 'published'")
    op.execute(
        """
        CREATE TABLE community.promise_milestone (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            promise_id  uuid NOT NULL REFERENCES community.promise (id) ON DELETE CASCADE,
            position    integer NOT NULL CHECK (position BETWEEN 1 AND 30),
            title_en    text NOT NULL CHECK (char_length(title_en) BETWEEN 3 AND 200),
            title_ta    text NOT NULL CHECK (char_length(title_ta) BETWEEN 3 AND 300),
            due_date    date,
            UNIQUE (promise_id, position)
        )
        """
    )
    op.execute(
        f"""
        CREATE TABLE community.promise_update (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            promise_id      uuid NOT NULL REFERENCES community.promise (id),
            new_status      text CHECK (new_status IS NULL OR new_status IN {STATUSES}),
            note_en         text NOT NULL CHECK (char_length(note_en) BETWEEN 5 AND 3000),
            note_ta         text NOT NULL CHECK (char_length(note_ta) BETWEEN 5 AND 4500),
            evidence_refs   text[] NOT NULL DEFAULT '{{}}',
            corrects_id     uuid REFERENCES community.promise_update (id),
            -- NULL for the system's own update: Delayed when the due date passes (FR-PRM-009).
            drafted_by      uuid REFERENCES npm.member (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX promise_update_promise ON community.promise_update (promise_id, created_at)")
    # The decision on each update is a separate row, so the update itself never changes.
    op.execute(
        """
        CREATE TABLE community.promise_update_decision (
            update_id    uuid PRIMARY KEY REFERENCES community.promise_update (id),
            approved     boolean NOT NULL,
            decided_by   uuid NOT NULL REFERENCES npm.member (id),
            reason       text CHECK (reason IS NULL OR char_length(reason) BETWEEN 3 AND 1000),
            decided_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT rejection_reason CHECK (approved OR reason IS NOT NULL)
        )
        """
    )
    for table in ("promise_update", "promise_update_decision"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON community.{table}
            FOR EACH ROW EXECUTE FUNCTION community.refuse_history_change()
            """
        )
    op.execute(
        """
        CREATE TABLE community.promise_feedback (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            promise_id         uuid NOT NULL REFERENCES community.promise (id),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            body               text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 1000),
            state              text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'published', 'rejected')),
            moderation_reason  text CHECK (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 3 AND 500),
            moderated_by       uuid REFERENCES npm.member (id),
            reply_en           text,
            reply_ta           text,
            replied_by         uuid REFERENCES npm.member (id),
            replied_at         timestamptz,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT feedback_rejection_reason CHECK (state <> 'rejected' OR moderation_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX promise_feedback_promise ON community.promise_feedback (promise_id, created_at)")

    op.execute(
        """
        CREATE TABLE community.scorecard (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            period          text NOT NULL CHECK (period ~ '^[0-9]{4}-Q[1-4]$'),
            version         integer NOT NULL DEFAULT 1,
            state           text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'shared', 'published', 'superseded')),
            sla_version     text NOT NULL,
            figures         jsonb NOT NULL,
            notes           jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_by      uuid NOT NULL REFERENCES npm.member (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            shared_at       timestamptz,
            publishable_at  timestamptz,
            published_by    uuid REFERENCES npm.member (id),
            published_at    timestamptz,
            correction_reason text,
            UNIQUE (period, version)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE community.scorecard_correction (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            scorecard_id   uuid NOT NULL REFERENCES community.scorecard (id),
            area_key       text NOT NULL,
            metric         text NOT NULL,
            reason         text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
            requested_by   uuid NOT NULL REFERENCES npm.member (id),
            state          text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'accepted', 'rejected')),
            decided_by     uuid REFERENCES npm.member (id),
            decision_note  text,
            created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            decided_at     timestamptz
        )
        """
    )


def downgrade() -> None:
    for table in (
        "scorecard_correction", "scorecard", "promise_feedback", "promise_update_decision", "promise_update",
        "promise_milestone", "promise",
    ):
        op.execute(f"DROP TABLE community.{table}")
    op.execute("DROP SEQUENCE community.promise_number_seq")
