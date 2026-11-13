"""Ask the Leader / Live Town Hall (BRD v1.1 FR-THL-001 to 009; screens M21 to M23, D18).

Revision ID: 0039
Revises: 0038

- community.townhall: a scheduled session with language, speakers and area; the streaming provider
  is not chosen yet (OD-44, DEP-20), so a session keeps the provider's stream, audio-only and
  caption links when they are known; a recorded legal review when it falls in an election period.
- community.townhall_question: text questions shown only after moderation, merged or rejected with
  a reason, answered live (with the time) or in writing afterwards.
- community.townhall_vote: one vote per member per approved question; only totals are shown.
- community.townhall_reminder: members who asked to be reminded 24 hours and 15 minutes before.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE community.townhall_number_seq")
    op.execute(
        """
        CREATE TABLE community.townhall (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            session_ref       text NOT NULL UNIQUE DEFAULT ('TH-' || lpad(nextval('community.townhall_number_seq')::text, 4, '0')),
            title_en          text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 160),
            title_ta          text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 220),
            description_en    text NOT NULL CHECK (char_length(description_en) BETWEEN 10 AND 2000),
            description_ta    text NOT NULL CHECK (char_length(description_ta) BETWEEN 10 AND 3000),
            language          text NOT NULL CHECK (language IN ('ta', 'en', 'both')),
            speakers_en       text NOT NULL CHECK (char_length(speakers_en) BETWEEN 3 AND 500),
            speakers_ta       text NOT NULL CHECK (char_length(speakers_ta) BETWEEN 3 AND 700),
            area_key          text NOT NULL,
            area_path         text[] NOT NULL,
            starts_at         timestamptz NOT NULL,
            ends_at           timestamptz NOT NULL,
            state             text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
            stream_url        text CHECK (stream_url IS NULL OR stream_url ~ '^https://'),
            audio_url         text CHECK (audio_url IS NULL OR audio_url ~ '^https://'),
            captions_url      text CHECK (captions_url IS NULL OR captions_url ~ '^https://'),
            recording_url     text CHECK (recording_url IS NULL OR recording_url ~ '^https://'),
            transcript_en     text,
            transcript_ta     text,
            legal_review_ref  text CHECK (legal_review_ref IS NULL OR char_length(legal_review_ref) BETWEEN 3 AND 200),
            outcomes          jsonb NOT NULL DEFAULT '[]'::jsonb,
            cancel_reason     text,
            created_by        uuid NOT NULL REFERENCES npm.member (id),
            created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            reminded_day_at   timestamptz,
            reminded_soon_at  timestamptz,
            CONSTRAINT townhall_times CHECK (ends_at > starts_at)
        )
        """
    )
    op.execute("CREATE INDEX townhall_area ON community.townhall USING gin (area_path)")
    op.execute("CREATE INDEX townhall_upcoming ON community.townhall (starts_at) WHERE state IN ('scheduled', 'live')")
    op.execute(
        """
        CREATE TABLE community.townhall_question (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            townhall_id        uuid NOT NULL REFERENCES community.townhall (id),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            body               text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 500),
            state              text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected', 'merged')),
            merged_into_id     uuid REFERENCES community.townhall_question (id),
            moderation_reason  text CHECK (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 3 AND 500),
            moderated_by       uuid REFERENCES npm.member (id),
            answer_mode        text CHECK (answer_mode IS NULL OR answer_mode IN ('live', 'written')),
            answered_at_second integer CHECK (answered_at_second IS NULL OR answered_at_second >= 0),
            answer_en          text,
            answer_ta          text,
            answered_at        timestamptz,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT question_rejection_reason CHECK (state NOT IN ('rejected', 'merged') OR moderation_reason IS NOT NULL),
            CONSTRAINT question_merge_target CHECK ((state = 'merged') = (merged_into_id IS NOT NULL)),
            CONSTRAINT question_written_answer CHECK (answer_mode <> 'written' OR (answer_en IS NOT NULL AND answer_ta IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX townhall_question_session ON community.townhall_question (townhall_id, state)")
    op.execute(
        """
        CREATE TABLE community.townhall_vote (
            question_id  uuid NOT NULL REFERENCES community.townhall_question (id),
            member_id    uuid NOT NULL REFERENCES npm.member (id),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (question_id, member_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE community.townhall_reminder (
            townhall_id  uuid NOT NULL REFERENCES community.townhall (id),
            member_id    uuid NOT NULL REFERENCES npm.member (id),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (townhall_id, member_id)
        )
        """
    )


def downgrade() -> None:
    for table in ("townhall_reminder", "townhall_vote", "townhall_question", "townhall"):
        op.execute(f"DROP TABLE community.{table}")
    op.execute("DROP SEQUENCE community.townhall_number_seq")
