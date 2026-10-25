"""Gallery albums, photos and photo removal requests

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-25

BRD v1.1 FR-GAL-001 to 007, FR-ADM-005, 006, BR-069 to BR-072. The Express
API keeps serving the live app's sample gallery from a file until the
member app moves over.

- content.album: a bilingual album (AL- reference) with publisher, place,
  date, area and an optional linked event. Draft, submitted for approval,
  then published by a different gallery.publish holder.
- content.photo: one photo of an album with bilingual captions. The images
  are WebP files in MEDIA_STORAGE_DIR, re-encoded without metadata; the
  database holds records only. A photo can be blurred or removed after a
  removal request.
- content.removal_request: a request to remove a photo (RR- reference) from
  a member or, through the public form, from someone who is not (FR-GAL-007).
  Due 24 hours after it was made (BR-070); once decided it is final.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA content")
    op.execute("CREATE SEQUENCE content.album_ref_seq")
    op.execute(
        """
        CREATE TABLE content.album (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            album_ref     text NOT NULL UNIQUE DEFAULT 'AL-' || lpad(nextval('content.album_ref_seq')::text, 6, '0'),
            title_en      text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 160),
            title_ta      text NOT NULL CHECK (char_length(title_ta) BETWEEN 1 AND 160),
            summary_en    text NOT NULL DEFAULT '' CHECK (char_length(summary_en) <= 2000),
            summary_ta    text NOT NULL DEFAULT '' CHECK (char_length(summary_ta) <= 2000),
            category      text NOT NULL CHECK (category IN ('events', 'community')),
            place         text NOT NULL DEFAULT '' CHECK (char_length(place) <= 200),
            album_date    date NOT NULL,
            -- The office credited on the album (FR-GAL-002), e.g. "Jaffna district media team".
            publisher     text NOT NULL CHECK (char_length(publisher) BETWEEN 1 AND 160),
            event_id      uuid REFERENCES events.event (id),
            area_key      text NOT NULL,
            area_path     text[] NOT NULL,
            state         text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted', 'published')),
            return_note   text CHECK (char_length(return_note) <= 1000),
            created_by    uuid NOT NULL REFERENCES npm.member (id),
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            submitted_by  uuid REFERENCES npm.member (id),
            submitted_at  timestamptz,
            published_by  uuid REFERENCES npm.member (id),
            published_at  timestamptz,
            CONSTRAINT album_published CHECK ((state = 'published') = (published_at IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX album_published_date ON content.album (album_date DESC) WHERE state = 'published'")
    op.execute("CREATE INDEX album_area_path ON content.album USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE content.photo (
            -- Chosen by the API before the row exists: the files are named by it.
            id          uuid PRIMARY KEY,
            album_id    uuid NOT NULL REFERENCES content.album (id),
            position    integer NOT NULL CHECK (position >= 1),
            caption_en  text NOT NULL DEFAULT '' CHECK (char_length(caption_en) <= 500),
            caption_ta  text NOT NULL DEFAULT '' CHECK (char_length(caption_ta) <= 500),
            width       integer NOT NULL CHECK (width > 0),
            height      integer NOT NULL CHECK (height > 0),
            state       text NOT NULL DEFAULT 'shown' CHECK (state IN ('shown', 'blurred', 'removed')),
            created_by  uuid NOT NULL REFERENCES npm.member (id),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT photo_position UNIQUE (album_id, position)
        )
        """
    )
    op.execute("CREATE SEQUENCE content.removal_ref_seq")
    op.execute(
        """
        CREATE TABLE content.removal_request (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_ref      text NOT NULL UNIQUE
                             DEFAULT 'RR-' || lpad(nextval('content.removal_ref_seq')::text, 6, '0'),
            photo_id         uuid NOT NULL REFERENCES content.photo (id),
            reason           text NOT NULL CHECK (reason IN ('appears_in_photo', 'safety', 'inaccurate', 'other')),
            note             text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
            requester_id     uuid REFERENCES npm.member (id),
            -- Someone who is not a member gives a way to reach them instead (FR-GAL-007).
            contact          text CHECK (char_length(contact) <= 200),
            requester_ip     text NOT NULL,
            area_path        text[] NOT NULL,
            state            text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'removed', 'blurred', 'kept')),
            decision_reason  text CHECK (char_length(decision_reason) <= 1000),
            decided_by       uuid REFERENCES npm.member (id),
            created_at       timestamptz NOT NULL DEFAULT now(),
            due_at           timestamptz NOT NULL DEFAULT now() + interval '24 hours',
            decided_at       timestamptz,
            CONSTRAINT removal_requester CHECK ((requester_id IS NULL) <> (contact IS NULL)),
            CONSTRAINT removal_decided CHECK ((state = 'open') = (decided_at IS NULL))
        )
        """
    )
    # One open request per member and photo: asking again returns the same receipt.
    op.execute(
        "CREATE UNIQUE INDEX removal_open_per_member ON content.removal_request (photo_id, requester_id) "
        "WHERE state = 'open' AND requester_id IS NOT NULL"
    )
    op.execute("CREATE INDEX removal_open_due ON content.removal_request (due_at) WHERE state = 'open'")
    op.execute(
        """
        CREATE FUNCTION content.keep_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF OLD.state <> 'open' THEN
                RAISE EXCEPTION 'content.removal_request % is decided and cannot change', OLD.request_ref;
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER removal_request_final BEFORE UPDATE ON content.removal_request
        FOR EACH ROW EXECUTE FUNCTION content.keep_decision()
        """
    )
    op.execute(
        """
        CREATE TRIGGER removal_request_no_delete BEFORE DELETE ON content.removal_request
        FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()
        """
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP SCHEMA content CASCADE")
