"""Offline field visits and the election duty roster (BRD v1.1 FR-FLD-001 to 009, FR-ELX-005 to 007, 009;
screens S05 to S07, D24, M30, S15).

Revision ID: 0040
Revises: 0039

- field.visit: a coordinator's community visit, made on the phone (often offline) and synchronised
  by its device id with a server version for conflict detection. Consent comes first: a declined
  visit keeps no categories, notes or place text (FR-FLD-004). There is no field for voting
  intention, political preference or persuasion, and none may be added (FR-FLD-006, BR-134).
- field.visit_count: monthly counts by GN and category, the only thing kept after the 12-month
  retention [OD-38] deletes the visits themselves (FR-FLD-009).
- election.roster_shift, roster_assignment and roster_message: an internal duty roster for
  volunteers with shifts, roles and sites, accept or decline, check-in and check-out with optional
  site confirmation and no location tracking, and operational messages within the sender's scope.
  Nothing here records a vote choice, intention or proof of voting (BR-129).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0040"
down_revision: str | None = "0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONCERNS = (
    "('water', 'roads', 'health', 'education', 'livelihood', 'housing', 'electricity', 'waste', 'safety',"
    " 'elderly_care', 'disability', 'other')"
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA field")
    op.execute("CREATE SEQUENCE field.visit_number_seq")
    op.execute(
        f"""
        CREATE TABLE field.visit (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            visit_ref        text NOT NULL UNIQUE DEFAULT ('FV-' || lpad(nextval('field.visit_number_seq')::text, 6, '0')),
            client_id        uuid NOT NULL UNIQUE,
            coordinator_id   uuid NOT NULL REFERENCES npm.member (id),
            gn_code          text NOT NULL REFERENCES geo.gn_division (gn_code),
            area_path        text[] NOT NULL,
            visited_at       timestamptz NOT NULL,
            consent          text NOT NULL CHECK (consent IN ('given', 'declined')),
            concerns         text[] NOT NULL DEFAULT '{{}}' CHECK (concerns <@ ARRAY{CONCERNS.replace("(", "[").replace(")", "]")}::text[]),
            notes            text CHECK (notes IS NULL OR char_length(notes) <= 1000),
            place_text       text CHECK (place_text IS NULL OR char_length(place_text) <= 200),
            follow_up        text CHECK (follow_up IS NULL OR char_length(follow_up) <= 500),
            follow_up_by     uuid REFERENCES npm.member (id),
            follow_up_done_at timestamptz,
            case_number      text CHECK (case_number IS NULL OR case_number ~ '^CI-[0-9]{{5,}}$'),
            version          integer NOT NULL DEFAULT 1,
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            -- FR-FLD-004: a declined visit holds no personal or descriptive data at all.
            CONSTRAINT declined_keeps_nothing CHECK (consent = 'given' OR (cardinality(concerns) = 0 AND notes IS NULL
                AND place_text IS NULL AND follow_up IS NULL AND case_number IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX visit_area ON field.visit USING gin (area_path)")
    op.execute("CREATE INDEX visit_coordinator ON field.visit (coordinator_id, updated_at DESC)")
    op.execute("CREATE INDEX visit_age ON field.visit (visited_at)")
    op.execute(
        """
        CREATE TABLE field.visit_count (
            gn_code   text NOT NULL,
            month     date NOT NULL,
            concern   text NOT NULL,
            visits    integer NOT NULL,
            PRIMARY KEY (gn_code, month, concern)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE election.roster_shift (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            period_id   uuid NOT NULL REFERENCES election.period (id),
            role_en     text NOT NULL CHECK (char_length(role_en) BETWEEN 3 AND 120),
            role_ta     text NOT NULL CHECK (char_length(role_ta) BETWEEN 3 AND 160),
            site_en     text NOT NULL CHECK (char_length(site_en) BETWEEN 3 AND 200),
            site_ta     text NOT NULL CHECK (char_length(site_ta) BETWEEN 3 AND 300),
            area_key    text NOT NULL,
            area_path   text[] NOT NULL,
            starts_at   timestamptz NOT NULL,
            ends_at     timestamptz NOT NULL,
            places      integer NOT NULL CHECK (places BETWEEN 1 AND 200),
            state       text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'cancelled')),
            created_by  uuid NOT NULL REFERENCES npm.member (id),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT shift_times CHECK (ends_at > starts_at)
        )
        """
    )
    op.execute("CREATE INDEX roster_shift_area ON election.roster_shift USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE election.roster_assignment (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            shift_id        uuid NOT NULL REFERENCES election.roster_shift (id),
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            state           text NOT NULL DEFAULT 'offered' CHECK (state IN ('offered', 'accepted', 'declined', 'cancelled')),
            assigned_by     uuid NOT NULL REFERENCES npm.member (id),
            responded_at    timestamptz,
            checked_in_at   timestamptz,
            checked_out_at  timestamptz,
            site_confirmed  boolean,
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (shift_id, member_id),
            CONSTRAINT checkout_after_checkin CHECK (checked_out_at IS NULL OR checked_in_at IS NOT NULL)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE election.roster_message (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            shift_id    uuid NOT NULL REFERENCES election.roster_shift (id),
            body_en     text NOT NULL CHECK (char_length(body_en) BETWEEN 3 AND 500),
            body_ta     text NOT NULL CHECK (char_length(body_ta) BETWEEN 3 AND 800),
            sent_by     uuid NOT NULL REFERENCES npm.member (id),
            recipients  integer NOT NULL,
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE election.roster_message")
    op.execute("DROP TABLE election.roster_assignment")
    op.execute("DROP TABLE election.roster_shift")
    op.execute("DROP SCHEMA field CASCADE")
