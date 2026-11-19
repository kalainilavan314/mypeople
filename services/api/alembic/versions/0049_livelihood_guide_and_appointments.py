"""Welfare, jobs and livelihood guide, and Meet Your Representative (BRD v1.1 FR-LIV-001 to 006,
FR-APT-001 to 007, BR-142, BR-143; ENT-57, ENT-58; screens M39 to M42, S17, D28, D29).

Revision ID: 0049
Revises: 0045

- content.guide_entry: a guide item in Tamil and English with its source link, publication date,
  last-verified date and optional end date. Drafts may be incomplete (D28 saves drafts as the
  editor goes); a published entry must be complete in both languages with a source (FR-LIV-002,
  005), and a second person reviews it before publication (FR-LIV-003). Expiry is read from
  expires_on, so an entry leaves the member list the day after its end date without a job.
- content.guide_report: a member's report that an entry is outdated (FR-LIV-006); one open report
  per member and entry.
- events.representative: a public role profile with the District, DS or GN it covers, office
  hours and contact routes. The routes are shown to members only after the person approves them
  (contacts_approved_at, BR-143); any change to them clears the approval.
- events.appointment_slot: published slots. ENT-58 names an EXCLUDE USING gist constraint, which
  needs the btree_gist extension; that extension cannot be loaded on the Windows development
  machines (Application Control), so a trigger with a row lock on the representative refuses
  overlapping open slots instead [ASSUMPTION].
- events.appointment: a booking with the member's contact preference, needs and a case reference
  stored only with recorded consent (FR-APT-004, 005, BR-159); one live booking per slot; the
  follow-up note the member sees (FR-APT-006); reminder times (FR-APT-003).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0049"
down_revision: str | None = "0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = (
    "('assistance_programme', 'scholarship', 'job', 'vocational_training', 'agriculture', 'fisheries',"
    " 'enterprise_grant', 'course', 'public_service_contact')"
)
NEEDS = (
    "ARRAY['step_free_access', 'sign_language', 'tamil_interpreter', 'sinhala_interpreter', 'english_interpreter',"
    " 'large_print', 'someone_with_me']::text[]"
)
PHONE = r"'^(\+94|0)[0-9]{9}$'"


def upgrade() -> None:
    op.execute("CREATE SEQUENCE content.guide_entry_number_seq")
    op.execute(
        f"""
        CREATE TABLE content.guide_entry (
            id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            entry_ref            text NOT NULL UNIQUE
                                 DEFAULT ('LG-' || lpad(nextval('content.guide_entry_number_seq')::text, 4, '0')),
            category             text NOT NULL CHECK (category IN {CATEGORIES}),
            title_en             text CHECK (title_en IS NULL OR char_length(title_en) BETWEEN 3 AND 160),
            title_ta             text CHECK (title_ta IS NULL OR char_length(title_ta) BETWEEN 3 AND 220),
            summary_en           text CHECK (summary_en IS NULL OR char_length(summary_en) BETWEEN 10 AND 400),
            summary_ta           text CHECK (summary_ta IS NULL OR char_length(summary_ta) BETWEEN 10 AND 600),
            body_en              text CHECK (body_en IS NULL OR char_length(body_en) BETWEEN 10 AND 4000),
            body_ta              text CHECK (body_ta IS NULL OR char_length(body_ta) BETWEEN 10 AND 6000),
            provider_en          text CHECK (provider_en IS NULL OR char_length(provider_en) BETWEEN 2 AND 200),
            provider_ta          text CHECK (provider_ta IS NULL OR char_length(provider_ta) BETWEEN 2 AND 300),
            contact              text CHECK (contact IS NULL OR char_length(contact) BETWEEN 3 AND 300),
            source_url           text CHECK (source_url IS NULL OR (source_url ~ '^https?://' AND char_length(source_url) <= 500)),
            published_on         date,
            verified_on          date,
            expires_on           date,
            state                text NOT NULL DEFAULT 'draft'
                                 CHECK (state IN ('draft', 'in_review', 'published', 'withdrawn')),
            drafted_by           uuid NOT NULL REFERENCES npm.member (id),
            updated_by           uuid NOT NULL REFERENCES npm.member (id),
            review_requested_by  uuid REFERENCES npm.member (id),
            reviewed_by          uuid REFERENCES npm.member (id),
            review_note          text CHECK (review_note IS NULL OR char_length(review_note) BETWEEN 3 AND 1000),
            published_at         timestamptz,
            verified_by          uuid REFERENCES npm.member (id),
            withdrawn_reason     text CHECK (withdrawn_reason IS NULL OR char_length(withdrawn_reason) BETWEEN 3 AND 500),
            created_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT guide_entry_published_complete CHECK (
                state <> 'published' OR (
                    title_en IS NOT NULL AND title_ta IS NOT NULL AND summary_en IS NOT NULL AND summary_ta IS NOT NULL
                    AND body_en IS NOT NULL AND body_ta IS NOT NULL AND provider_en IS NOT NULL
                    AND provider_ta IS NOT NULL AND source_url IS NOT NULL AND published_on IS NOT NULL
                    AND verified_on IS NOT NULL AND reviewed_by IS NOT NULL
                )
            ),
            CONSTRAINT guide_entry_second_person CHECK (
                state <> 'published' OR (reviewed_by <> updated_by AND reviewed_by IS DISTINCT FROM review_requested_by)
            ),
            CONSTRAINT guide_entry_withdrawn_reason CHECK (state <> 'withdrawn' OR withdrawn_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX guide_entry_published ON content.guide_entry (category, verified_on) WHERE state = 'published'")
    op.execute(
        """
        CREATE TABLE content.guide_report (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            entry_id         uuid NOT NULL REFERENCES content.guide_entry (id),
            member_id        uuid NOT NULL REFERENCES npm.member (id),
            reason           text NOT NULL CHECK (reason IN ('outdated', 'closed', 'broken_link', 'wrong_details', 'other')),
            note             text CHECK (note IS NULL OR char_length(note) BETWEEN 3 AND 500),
            state            text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'fixed', 'dismissed')),
            resolved_by      uuid REFERENCES npm.member (id),
            resolution_note  text CHECK (resolution_note IS NULL OR char_length(resolution_note) BETWEEN 3 AND 500),
            resolved_at      timestamptz,
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT guide_report_resolved CHECK (state = 'open' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX guide_report_one_open ON content.guide_report (entry_id, member_id) WHERE state = 'open'")
    op.execute("CREATE INDEX guide_report_queue ON content.guide_report (created_at) WHERE state = 'open'")

    op.execute(
        f"""
        CREATE TABLE events.representative (
            id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id            uuid NOT NULL UNIQUE REFERENCES npm.member (id),
            role_en              text NOT NULL CHECK (char_length(role_en) BETWEEN 3 AND 160),
            role_ta              text NOT NULL CHECK (char_length(role_ta) BETWEEN 3 AND 220),
            display_name_en      text NOT NULL CHECK (char_length(display_name_en) BETWEEN 2 AND 120),
            display_name_ta      text NOT NULL CHECK (char_length(display_name_ta) BETWEEN 2 AND 160),
            area_key             text NOT NULL CHECK (area_key ~ '^(district|ds|gn):'),
            area_path            text[] NOT NULL,
            office_hours_en      text NOT NULL CHECK (char_length(office_hours_en) BETWEEN 3 AND 500),
            office_hours_ta      text NOT NULL CHECK (char_length(office_hours_ta) BETWEEN 3 AND 700),
            public_phone         text CHECK (public_phone IS NULL OR public_phone ~ {PHONE}),
            public_email         text CHECK (public_email IS NULL OR (public_email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
                                                                       AND char_length(public_email) <= 200)),
            office_address_en    text CHECK (office_address_en IS NULL OR char_length(office_address_en) BETWEEN 5 AND 300),
            office_address_ta    text CHECK (office_address_ta IS NULL OR char_length(office_address_ta) BETWEEN 5 AND 450),
            -- BR-143: the person's own approval of the contact routes exactly as they are now.
            contacts_approved_at timestamptz,
            state                text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'withdrawn')),
            withdrawn_reason     text CHECK (withdrawn_reason IS NULL OR char_length(withdrawn_reason) BETWEEN 3 AND 500),
            created_by           uuid NOT NULL REFERENCES npm.member (id),
            updated_by           uuid NOT NULL REFERENCES npm.member (id),
            published_by         uuid REFERENCES npm.member (id),
            published_at         timestamptz,
            created_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT representative_withdrawn_reason CHECK (state <> 'withdrawn' OR withdrawn_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX representative_area ON events.representative USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE events.appointment_slot (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            representative_id  uuid NOT NULL REFERENCES events.representative (id),
            starts_at          timestamptz NOT NULL,
            ends_at            timestamptz NOT NULL,
            mode               text NOT NULL CHECK (mode IN ('in_person', 'phone_call')),
            place_en           text CHECK (place_en IS NULL OR char_length(place_en) BETWEEN 3 AND 300),
            place_ta           text CHECK (place_ta IS NULL OR char_length(place_ta) BETWEEN 3 AND 450),
            state              text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'withdrawn')),
            withdrawn_reason   text CHECK (withdrawn_reason IS NULL OR char_length(withdrawn_reason) BETWEEN 3 AND 500),
            created_by         uuid NOT NULL REFERENCES npm.member (id),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT appointment_slot_length CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '4 hours'),
            CONSTRAINT appointment_slot_place CHECK (mode <> 'in_person' OR (place_en IS NOT NULL AND place_ta IS NOT NULL)),
            CONSTRAINT appointment_slot_withdrawn_reason CHECK (state <> 'withdrawn' OR withdrawn_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX appointment_slot_calendar ON events.appointment_slot (representative_id, starts_at)")
    op.execute(
        """
        CREATE FUNCTION events.refuse_overlapping_slot() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.state = 'open' THEN
                -- Two sessions adding slots for one representative wait for each other here.
                PERFORM 1 FROM events.representative WHERE id = NEW.representative_id FOR UPDATE;
                IF EXISTS (
                    SELECT 1 FROM events.appointment_slot s
                    WHERE s.representative_id = NEW.representative_id AND s.id <> NEW.id AND s.state = 'open'
                      AND tstzrange(s.starts_at, s.ends_at) && tstzrange(NEW.starts_at, NEW.ends_at)
                ) THEN
                    RAISE EXCEPTION 'appointment slots of one representative may not overlap'
                        USING ERRCODE = 'exclusion_violation';
                END IF;
            END IF;
            RETURN NEW;
        END
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER appointment_slot_no_overlap BEFORE INSERT OR UPDATE ON events.appointment_slot
        FOR EACH ROW EXECUTE FUNCTION events.refuse_overlapping_slot()
        """
    )
    op.execute("CREATE SEQUENCE events.appointment_number_seq")
    op.execute(
        f"""
        CREATE TABLE events.appointment (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            appointment_ref     text NOT NULL UNIQUE
                                DEFAULT ('AP-' || lpad(nextval('events.appointment_number_seq')::text, 5, '0')),
            slot_id             uuid NOT NULL REFERENCES events.appointment_slot (id),
            representative_id   uuid NOT NULL REFERENCES events.representative (id),
            member_id           uuid NOT NULL REFERENCES npm.member (id),
            topic               text NOT NULL CHECK (char_length(topic) BETWEEN 5 AND 500),
            contact_preference  text NOT NULL CHECK (contact_preference IN ('in_app', 'phone_call', 'sms')),
            -- Only the number the member typed for this booking, and only when they asked to be called or texted.
            contact_phone       text CHECK (contact_phone IS NULL OR contact_phone ~ {PHONE}),
            needs               text[] NOT NULL DEFAULT '{{}}' CHECK (needs <@ {NEEDS}),
            needs_note          text CHECK (needs_note IS NULL OR char_length(needs_note) BETWEEN 2 AND 300),
            case_ref            text CHECK (case_ref IS NULL OR case_ref ~ '^[A-Z]{{2,4}}-[0-9A-Z-]{{3,20}}$'),
            case_consent_at     timestamptz,
            state               text NOT NULL DEFAULT 'booked' CHECK (state IN ('booked', 'cancelled', 'completed', 'no_show')),
            cancelled_by        text CHECK (cancelled_by IS NULL OR cancelled_by IN ('member', 'representative')),
            cancel_reason       text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) BETWEEN 3 AND 500),
            cancelled_at        timestamptz,
            follow_up_note      text CHECK (follow_up_note IS NULL OR char_length(follow_up_note) BETWEEN 5 AND 2000),
            follow_up_by        uuid REFERENCES npm.member (id),
            follow_up_at        timestamptz,
            booked_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
            reminded_day_at     timestamptz,
            reminded_hour_at    timestamptz,
            created_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT appointment_contact CHECK ((contact_preference = 'in_app') = (contact_phone IS NULL)),
            -- FR-APT-005, BR-159: a case reference only with the member's recorded consent.
            CONSTRAINT appointment_case_consent CHECK (case_ref IS NULL OR case_consent_at IS NOT NULL),
            CONSTRAINT appointment_cancelled CHECK (
                (state = 'cancelled') = (cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
            )
        )
        """
    )
    # No double booking: one live (or held) booking per slot; a cancelled booking frees the slot.
    op.execute("CREATE UNIQUE INDEX appointment_one_per_slot ON events.appointment (slot_id) WHERE state <> 'cancelled'")
    op.execute("CREATE INDEX appointment_member ON events.appointment (member_id, created_at)")
    op.execute("CREATE INDEX appointment_reminders ON events.appointment (slot_id) WHERE state = 'booked'")


def downgrade() -> None:
    op.execute("DROP TABLE events.appointment")
    op.execute("DROP SEQUENCE events.appointment_number_seq")
    op.execute("DROP TRIGGER appointment_slot_no_overlap ON events.appointment_slot")
    op.execute("DROP FUNCTION events.refuse_overlapping_slot()")
    op.execute("DROP TABLE events.appointment_slot")
    op.execute("DROP TABLE events.representative")
    op.execute("DROP TABLE content.guide_report")
    op.execute("DROP TABLE content.guide_entry")
    op.execute("DROP SEQUENCE content.guide_entry_number_seq")
