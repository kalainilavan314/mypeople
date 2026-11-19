"""Wings and committees, and diaspora participation (BRD v1.1 FR-COM-001 to 009, FR-DSP-001 to 006,
screens M31, M32, S18, D23 and M46; ENT-48, ENT-49, ENT-59).

Revision ID: 0047
Revises: 0045

- engagement.committee: wings (youth, women's, farmers', fishers', professional, diaspora) and the
  committees inside them, each with its own area. A wing or committee is only proposed when it is
  created; it exists for members once a Tier 5 approves it (FR-COM-001).
- engagement.committee_membership: one row per member and committee: the application, the
  coordinator's decision and the member's role (coordinator, secretary or member), FR-COM-002, 003.
- engagement.committee_item: announcements, meetings, minutes (approved before members see them),
  tasks, volunteer opportunities with due dates, documents with the roles that may open them, and
  discussion threads, all inside one committee (FR-COM-004 to 008, ENT-49).
- engagement.committee_post: replies in a discussion thread, moderated. There is no table for
  messages between members: the committee space has no direct messages (OS-17).
- engagement.committee_signup: who offered to help with a committee's volunteer opportunity.
- engagement.volunteer_opportunity.remote: a remote, skill-based opportunity, shown as "Remote" and
  open to members wherever they live (FR-DSP-003).
- diaspora.supporter: an overseas supporter's country, time zone and contact preferences, kept apart
  from identity verification and conferring no right to contribute (FR-DSP-001, BR-147). Deleted
  when the supporter withdraws.
- diaspora.international_event: events marked as open to overseas supporters (FR-DSP-002).
- diaspora.proposal_tag: development proposals sent by a registered supporter, for aggregate
  analysis only: it holds no member id (FR-DSP-004).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0047"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WING_TYPES = "('youth', 'women', 'farmers', 'fishers', 'professional', 'diaspora')"
ITEM_TYPES = "('announcement', 'meeting', 'minutes', 'task', 'volunteer', 'document', 'thread')"


def upgrade() -> None:
    op.execute("CREATE SEQUENCE engagement.committee_number_seq")
    op.execute(
        f"""
        CREATE TABLE engagement.committee (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            committee_ref   text NOT NULL UNIQUE
                            DEFAULT ('CM-' || lpad(nextval('engagement.committee_number_seq')::text, 4, '0')),
            kind            text NOT NULL CHECK (kind IN ('wing', 'committee')),
            wing_type       text NOT NULL CHECK (wing_type IN {WING_TYPES}),
            wing_id         uuid REFERENCES engagement.committee (id),
            name_en         text NOT NULL CHECK (char_length(name_en) BETWEEN 3 AND 120),
            name_ta         text NOT NULL CHECK (char_length(name_ta) BETWEEN 3 AND 160),
            purpose_en      text NOT NULL CHECK (char_length(purpose_en) BETWEEN 10 AND 1000),
            purpose_ta      text NOT NULL CHECK (char_length(purpose_ta) BETWEEN 10 AND 1500),
            area_key        text NOT NULL,
            area_path       text[] NOT NULL,
            state           text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'active', 'rejected', 'closed')),
            proposed_by     uuid NOT NULL REFERENCES npm.member (id),
            proposed_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            decided_by      uuid REFERENCES npm.member (id),
            decided_at      timestamptz,
            decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500),
            closed_by       uuid REFERENCES npm.member (id),
            closed_at       timestamptz,
            close_reason    text CHECK (close_reason IS NULL OR char_length(close_reason) <= 500),
            updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT committee_wing CHECK ((kind = 'wing') = (wing_id IS NULL)),
            CONSTRAINT committee_decided CHECK (state = 'proposed' OR decided_by IS NOT NULL),
            CONSTRAINT committee_rejection_reason CHECK (state <> 'rejected' OR decision_reason IS NOT NULL),
            CONSTRAINT committee_close_reason CHECK (state <> 'closed' OR close_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX committee_area ON engagement.committee USING gin (area_path)")
    op.execute("CREATE INDEX committee_wing_children ON engagement.committee (wing_id) WHERE wing_id IS NOT NULL")

    op.execute(
        """
        CREATE TABLE engagement.committee_membership (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            committee_id     uuid NOT NULL REFERENCES engagement.committee (id),
            member_id        uuid NOT NULL REFERENCES npm.member (id),
            state            text NOT NULL DEFAULT 'applied'
                             CHECK (state IN ('applied', 'approved', 'declined', 'withdrawn', 'left', 'removed')),
            role             text CHECK (role IN ('coordinator', 'secretary', 'member')),
            application_note text CHECK (application_note IS NULL OR char_length(application_note) <= 500),
            applied_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            decided_by       uuid REFERENCES npm.member (id),
            decided_at       timestamptz,
            decision_reason  text CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500),
            role_set_by      uuid REFERENCES npm.member (id),
            role_set_at      timestamptz,
            ended_by         uuid REFERENCES npm.member (id),
            ended_at         timestamptz,
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT committee_membership_once UNIQUE (committee_id, member_id),
            CONSTRAINT committee_membership_role CHECK ((state = 'approved') = (role IS NOT NULL)),
            CONSTRAINT committee_membership_decline_reason CHECK (state <> 'declined' OR decision_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX committee_membership_member ON engagement.committee_membership (member_id, state)")
    op.execute("CREATE INDEX committee_membership_roster ON engagement.committee_membership (committee_id, state)")

    op.execute("CREATE SEQUENCE engagement.committee_item_number_seq")
    op.execute(
        f"""
        CREATE TABLE engagement.committee_item (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            item_ref        text NOT NULL UNIQUE
                            DEFAULT ('CI-' || lpad(nextval('engagement.committee_item_number_seq')::text, 6, '0')),
            committee_id    uuid NOT NULL REFERENCES engagement.committee (id),
            item_type       text NOT NULL CHECK (item_type IN {ITEM_TYPES}),
            title           text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
            body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
            author_id       uuid NOT NULL REFERENCES npm.member (id),
            state           text NOT NULL CHECK (state IN ('published', 'awaiting_approval', 'returned', 'hidden')),
            starts_at       timestamptz,
            ends_at         timestamptz,
            place           text CHECK (place IS NULL OR char_length(place) BETWEEN 2 AND 200),
            meeting_id      uuid REFERENCES engagement.committee_item (id),
            due_on          date,
            assignee_id     uuid REFERENCES npm.member (id),
            places          integer CHECK (places IS NULL OR places BETWEEN 1 AND 500),
            done_at         timestamptz,
            done_by         uuid REFERENCES npm.member (id),
            access_roles    text[] NOT NULL DEFAULT '{{coordinator,secretary,member}}'
                            CHECK (access_roles <@ ARRAY['coordinator', 'secretary', 'member']
                                   AND 'coordinator' = ANY (access_roles)),
            decided_by      uuid REFERENCES npm.member (id),
            decided_at      timestamptz,
            decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500),
            hidden_by       uuid REFERENCES npm.member (id),
            hidden_at       timestamptz,
            hidden_reason   text CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 500),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT committee_meeting_time CHECK (item_type <> 'meeting' OR starts_at IS NOT NULL),
            CONSTRAINT committee_meeting_end CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at > starts_at)),
            CONSTRAINT committee_minutes_meeting CHECK ((item_type = 'minutes') = (meeting_id IS NOT NULL)),
            CONSTRAINT committee_due_date CHECK (item_type NOT IN ('task', 'volunteer') OR due_on IS NOT NULL),
            CONSTRAINT committee_task_assignee CHECK ((item_type = 'task') = (assignee_id IS NOT NULL)),
            CONSTRAINT committee_volunteer_places CHECK ((item_type = 'volunteer') = (places IS NOT NULL)),
            CONSTRAINT committee_hidden_reason CHECK (state <> 'hidden' OR hidden_reason IS NOT NULL),
            CONSTRAINT committee_returned_reason CHECK (state <> 'returned' OR decision_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX committee_item_space ON engagement.committee_item (committee_id, item_type, created_at DESC)")
    op.execute("CREATE INDEX committee_item_assignee ON engagement.committee_item (assignee_id) WHERE assignee_id IS NOT NULL")

    op.execute(
        """
        CREATE TABLE engagement.committee_post (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            thread_id       uuid NOT NULL REFERENCES engagement.committee_item (id),
            author_id       uuid NOT NULL REFERENCES npm.member (id),
            body            text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 2000),
            state           text NOT NULL CHECK (state IN ('published', 'awaiting_approval', 'returned', 'hidden')),
            decided_by      uuid REFERENCES npm.member (id),
            decided_at      timestamptz,
            decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT committee_post_reason CHECK (state NOT IN ('returned', 'hidden') OR decision_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX committee_post_thread ON engagement.committee_post (thread_id, created_at)")

    op.execute(
        """
        CREATE TABLE engagement.committee_signup (
            item_id       uuid NOT NULL REFERENCES engagement.committee_item (id),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            signed_up_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            withdrawn_at  timestamptz,
            PRIMARY KEY (item_id, member_id)
        )
        """
    )

    op.execute("ALTER TABLE engagement.volunteer_opportunity ADD COLUMN remote boolean NOT NULL DEFAULT false")

    op.execute("CREATE SCHEMA diaspora")
    op.execute(
        """
        CREATE TABLE diaspora.supporter (
            member_id        uuid PRIMARY KEY REFERENCES npm.member (id),
            country_code     text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$' AND country_code <> 'LK'),
            time_zone        text NOT NULL CHECK (char_length(time_zone) BETWEEN 3 AND 64),
            contact_topics   text[] NOT NULL DEFAULT '{}'
                             CHECK (contact_topics <@ ARRAY['international_events', 'committee_networking']),
            skills           text[] NOT NULL DEFAULT '{}' CHECK (cardinality(skills) <= 10),
            consent_version  text NOT NULL,
            registered_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE diaspora.international_event (
            event_id   uuid PRIMARY KEY REFERENCES events.event (id),
            marked_by  uuid NOT NULL REFERENCES npm.member (id),
            marked_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE diaspora.proposal_tag (
            proposal_id  uuid PRIMARY KEY REFERENCES community.proposal (id),
            tagged_at    timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE diaspora.proposal_tag")
    op.execute("DROP TABLE diaspora.international_event")
    op.execute("DROP TABLE diaspora.supporter")
    op.execute("DROP SCHEMA diaspora")
    op.execute("ALTER TABLE engagement.volunteer_opportunity DROP COLUMN remote")
    op.execute("DROP TABLE engagement.committee_signup")
    op.execute("DROP TABLE engagement.committee_post")
    op.execute("DROP TABLE engagement.committee_item")
    op.execute("DROP SEQUENCE engagement.committee_item_number_seq")
    op.execute("DROP TABLE engagement.committee_membership")
    op.execute("DROP TABLE engagement.committee")
    op.execute("DROP SEQUENCE engagement.committee_number_seq")
