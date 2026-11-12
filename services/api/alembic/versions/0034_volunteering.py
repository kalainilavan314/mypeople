"""Volunteering: skills profiles, opportunities, offers and coordinator contact (BRD v1.1 FR-VOL-001 to 008,
screens H10 to H12 and S10).

Revision ID: 0034
Revises: 0033

- engagement.volunteer_skill: the configurable skills list, seeded with the BRD's first five.
- engagement.volunteer_profile: a member's skills, availability and travel area, kept only with
  their consent to share them with authorised coordinators (FR-VOL-003, BR-041).
- engagement.volunteer_opportunity: a briefing with time, place, role, what to bring and the
  coordinating team (FR-VOL-004), scoped to an area and optionally linked to an event.
- engagement.volunteer_offer and its append-only history: "Offer to help", the coordinator's
  confirmation with role and meeting point, and every change (FR-VOL-005, 006, 008).
- engagement.volunteer_bookmark: "Save for later".
- engagement.volunteer_contact: messages and change requests to the coordinators through the app,
  so no personal phone number is ever shown (FR-VOL-007, BR-040).

The event duty assignments in staff_ops (Alembic 0023) are unchanged and still appear in H12.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AVAILABILITY = "('weekday_mornings', 'weekday_afternoons', 'weekday_evenings', 'weekends', 'public_holidays')"


def upgrade() -> None:
    op.execute("CREATE SCHEMA engagement")
    op.execute(
        """
        CREATE TABLE engagement.volunteer_skill (
            key        text PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
            name_en    text NOT NULL CHECK (char_length(name_en) BETWEEN 2 AND 60),
            name_ta    text NOT NULL CHECK (char_length(name_ta) BETWEEN 2 AND 80),
            position   integer NOT NULL,
            active     boolean NOT NULL DEFAULT true
        )
        """
    )
    op.execute(
        """
        INSERT INTO engagement.volunteer_skill (key, name_en, name_ta, position) VALUES
            ('teaching', 'Teaching', 'கற்பித்தல்', 1),
            ('it_support', 'IT support', 'தகவல் தொழில்நுட்ப உதவி', 2),
            ('translation', 'Translation', 'மொழிபெயர்ப்பு', 3),
            ('field_work', 'Field work', 'களப் பணி', 4),
            ('event_logistics', 'Event logistics', 'நிகழ்வு ஏற்பாடுகள்', 5)
        """
    )
    op.execute(
        f"""
        CREATE TABLE engagement.volunteer_profile (
            member_id        uuid PRIMARY KEY REFERENCES npm.member (id),
            skills           text[] NOT NULL CHECK (cardinality(skills) BETWEEN 1 AND 10),
            availability     text[] NOT NULL CHECK (cardinality(availability) BETWEEN 1 AND 5
                                 AND availability <@ ARRAY{AVAILABILITY.replace("(", "[").replace(")", "]")}::text[]),
            travel_area      text NOT NULL CHECK (travel_area IN ('my_gn', 'my_ds')),
            consent_version  text NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 40),
            consented_at     timestamptz NOT NULL,
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )

    op.execute("CREATE SEQUENCE engagement.opportunity_number_seq")
    op.execute(
        """
        CREATE TABLE engagement.volunteer_opportunity (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            opportunity_ref text NOT NULL UNIQUE
                            DEFAULT ('VO-' || lpad(nextval('engagement.opportunity_number_seq')::text, 5, '0')),
            title_en        text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 120),
            title_ta        text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 160),
            role_en         text NOT NULL CHECK (char_length(role_en) BETWEEN 3 AND 120),
            role_ta         text NOT NULL CHECK (char_length(role_ta) BETWEEN 3 AND 160),
            description_en  text NOT NULL CHECK (char_length(description_en) BETWEEN 10 AND 2000),
            description_ta  text NOT NULL CHECK (char_length(description_ta) BETWEEN 10 AND 3000),
            place_en        text NOT NULL CHECK (char_length(place_en) BETWEEN 3 AND 200),
            place_ta        text NOT NULL CHECK (char_length(place_ta) BETWEEN 3 AND 300),
            bring_en        text NOT NULL CHECK (char_length(bring_en) BETWEEN 2 AND 500),
            bring_ta        text NOT NULL CHECK (char_length(bring_ta) BETWEEN 2 AND 800),
            team_en         text NOT NULL CHECK (char_length(team_en) BETWEEN 3 AND 120),
            team_ta         text NOT NULL CHECK (char_length(team_ta) BETWEEN 3 AND 160),
            starts_at       timestamptz NOT NULL,
            ends_at         timestamptz NOT NULL,
            event_id        uuid REFERENCES events.event (id),
            skills          text[] NOT NULL DEFAULT '{}',
            places          integer NOT NULL CHECK (places BETWEEN 1 AND 500),
            area_key        text NOT NULL,
            area_path       text[] NOT NULL,
            state           text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'open', 'closed', 'cancelled')),
            cancel_reason   text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) BETWEEN 3 AND 500),
            created_by      uuid NOT NULL REFERENCES npm.member (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT opportunity_times CHECK (ends_at > starts_at),
            CONSTRAINT opportunity_cancel_reason CHECK (state <> 'cancelled' OR cancel_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX volunteer_opportunity_area ON engagement.volunteer_opportunity USING gin (area_path)")
    op.execute("CREATE INDEX volunteer_opportunity_open ON engagement.volunteer_opportunity (starts_at) WHERE state = 'open'")

    op.execute("CREATE SEQUENCE engagement.offer_number_seq")
    op.execute(
        """
        CREATE TABLE engagement.volunteer_offer (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            offer_ref         text NOT NULL UNIQUE
                              DEFAULT ('VF-' || lpad(nextval('engagement.offer_number_seq')::text, 5, '0')),
            opportunity_id    uuid NOT NULL REFERENCES engagement.volunteer_opportunity (id),
            member_id         uuid NOT NULL REFERENCES npm.member (id),
            state             text NOT NULL DEFAULT 'offered'
                              CHECK (state IN ('offered', 'confirmed', 'declined', 'withdrawn', 'cancelled')),
            role_en           text,
            role_ta           text,
            meeting_point_en  text CHECK (meeting_point_en IS NULL OR char_length(meeting_point_en) BETWEEN 3 AND 200),
            meeting_point_ta  text CHECK (meeting_point_ta IS NULL OR char_length(meeting_point_ta) BETWEEN 3 AND 300),
            decided_by        uuid REFERENCES npm.member (id),
            decided_at        timestamptz,
            decision_reason   text CHECK (decision_reason IS NULL OR char_length(decision_reason) BETWEEN 3 AND 500),
            created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT one_offer_per_opportunity UNIQUE (opportunity_id, member_id),
            CONSTRAINT confirmed_has_meeting_point CHECK (
                state <> 'confirmed' OR (meeting_point_en IS NOT NULL AND meeting_point_ta IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX volunteer_offer_member ON engagement.volunteer_offer (member_id, created_at DESC)")
    op.execute(
        """
        CREATE TABLE engagement.volunteer_offer_event (
            id          bigserial PRIMARY KEY,
            offer_id    uuid NOT NULL REFERENCES engagement.volunteer_offer (id),
            from_state  text,
            to_state    text NOT NULL,
            actor_id    uuid NOT NULL REFERENCES npm.member (id),
            reason      text CHECK (reason IS NULL OR char_length(reason) <= 1000),
            occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX volunteer_offer_event_offer ON engagement.volunteer_offer_event (offer_id, id)")
    op.execute(
        """
        CREATE FUNCTION engagement.refuse_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'volunteer history is append-only';
        END $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER volunteer_offer_event_append_only BEFORE UPDATE OR DELETE ON engagement.volunteer_offer_event
        FOR EACH ROW EXECUTE FUNCTION engagement.refuse_history_change()
        """
    )
    op.execute(
        """
        CREATE TABLE engagement.volunteer_bookmark (
            opportunity_id uuid NOT NULL REFERENCES engagement.volunteer_opportunity (id),
            member_id      uuid NOT NULL REFERENCES npm.member (id),
            created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (opportunity_id, member_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE engagement.volunteer_contact (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            offer_id     uuid NOT NULL REFERENCES engagement.volunteer_offer (id),
            member_id    uuid NOT NULL REFERENCES npm.member (id),
            kind         text NOT NULL CHECK (kind IN ('message', 'change_request')),
            body         text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 1000),
            state        text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'answered')),
            answer       text CHECK (answer IS NULL OR char_length(answer) BETWEEN 3 AND 1000),
            answered_by  uuid REFERENCES npm.member (id),
            answered_at  timestamptz,
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT answered_has_answer CHECK ((state = 'answered') = (answer IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX volunteer_contact_offer ON engagement.volunteer_contact (offer_id, created_at)")
    op.execute("CREATE INDEX volunteer_contact_open ON engagement.volunteer_contact (created_at) WHERE state = 'open'")


def downgrade() -> None:
    op.execute("DROP SCHEMA engagement CASCADE")
