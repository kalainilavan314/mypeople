"""Events, RSVPs, event passes and attendance

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-25

BRD v1.1 FR-EVT-001 to 017, FR-ADM-004, FR-STF-006, BR-057 to BR-062.
The Express API keeps its own npm.event tables for the live app; these are
the new API's, in their own schema.

- events.event: a bilingual event with venue, meeting point, agenda,
  accessibility notes, an approved contact route, optional capacity, a
  check-in window and a geographic scope. Draft, published or cancelled.
- events.rsvp: one record per member and event (BR-059): going, maybe,
  declined or waitlisted. pass_ref is the opaque reference an event pass
  carries; it exists only while the member is going, and is replaced when
  they stop going, so a pass is never a lasting identifier (BR-060).
- events.rsvp_change: every response, append-only, so a changed RSVP keeps
  its history (FR-EVT-010).
- events.attendance: one row per member and event, written only by a
  successful scan (BR-058, BR-061); it cannot be changed or deleted.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA events")
    op.execute("CREATE SEQUENCE events.event_ref_seq")
    op.execute(
        """
        CREATE TABLE events.event (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            event_ref          text NOT NULL UNIQUE
                               DEFAULT 'EV-' || lpad(nextval('events.event_ref_seq')::text, 6, '0'),
            title_en           text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 160),
            title_ta           text NOT NULL CHECK (char_length(title_ta) BETWEEN 1 AND 160),
            description_en     text NOT NULL DEFAULT '' CHECK (char_length(description_en) <= 4000),
            description_ta     text NOT NULL DEFAULT '' CHECK (char_length(description_ta) <= 4000),
            event_type         text NOT NULL,
            starts_at          timestamptz NOT NULL,
            ends_at            timestamptz NOT NULL,
            checkin_opens_at   timestamptz NOT NULL,
            checkin_closes_at  timestamptz NOT NULL,
            venue              text NOT NULL CHECK (char_length(venue) BETWEEN 1 AND 300),
            meeting_point      text NOT NULL DEFAULT '' CHECK (char_length(meeting_point) <= 300),
            agenda             text NOT NULL DEFAULT '' CHECK (char_length(agenda) <= 4000),
            accessibility      text NOT NULL DEFAULT '' CHECK (char_length(accessibility) <= 1000),
            -- An approved way to reach the organiser (FR-EVT-007): never a private number.
            contact_route      text NOT NULL DEFAULT '' CHECK (char_length(contact_route) <= 300),
            capacity           integer CHECK (capacity IS NULL OR capacity > 0),
            -- OD-12 [ASSUMPTION]: passes need an Active membership unless the event admits pending members.
            admits_pending     boolean NOT NULL DEFAULT false,
            area_key           text NOT NULL,
            area_path          text[] NOT NULL,
            state              text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'cancelled')),
            cancel_reason      text,
            created_by         uuid NOT NULL REFERENCES npm.member (id),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_by         uuid NOT NULL REFERENCES npm.member (id),
            updated_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            published_at       timestamptz,
            cancelled_at       timestamptz,
            CONSTRAINT event_times CHECK (ends_at > starts_at AND checkin_closes_at > checkin_opens_at),
            CONSTRAINT event_cancelled CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX event_published_start ON events.event (starts_at) WHERE state = 'published'")
    op.execute("CREATE INDEX event_area_path ON events.event USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE events.rsvp (
            event_id      uuid NOT NULL REFERENCES events.event (id),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            response      text NOT NULL CHECK (response IN ('going', 'maybe', 'declined', 'waitlisted')),
            responded_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            pass_ref      text UNIQUE,
            PRIMARY KEY (event_id, member_id),
            CONSTRAINT rsvp_pass_only_going CHECK (pass_ref IS NULL OR response = 'going')
        )
        """
    )
    op.execute("CREATE INDEX rsvp_member ON events.rsvp (member_id)")
    op.execute(
        """
        CREATE TABLE events.rsvp_change (
            id          bigserial PRIMARY KEY,
            event_id    uuid NOT NULL,
            member_id   uuid NOT NULL,
            response    text NOT NULL,
            changed_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            FOREIGN KEY (event_id, member_id) REFERENCES events.rsvp (event_id, member_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE events.attendance (
            event_id    uuid NOT NULL REFERENCES events.event (id),
            member_id   uuid NOT NULL REFERENCES npm.member (id),
            scanned_by  uuid NOT NULL REFERENCES npm.member (id),
            scanned_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (event_id, member_id)
        )
        """
    )
    for table in ("rsvp_change", "attendance"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON events.{table}
            FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()
            """
        )
        op.execute(
            f"""
            CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON events.{table}
            FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_change()
            """
        )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP SCHEMA events CASCADE")
