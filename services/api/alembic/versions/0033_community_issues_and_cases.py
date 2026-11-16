"""Community issues and the five-tier case workflow (BRD v1.1 FR-RPT-001 to 017, FR-WEB-014 to 029).

Revision ID: 0033
Revises: 0032

- community.issue: a member's report and the case it becomes (ENT-09 Issue): case ID, category,
  location descriptor, description, visibility, stage, owner and stage deadline.
- community.case_action: every handoff, finding, decision, escalation and closure (ENT-10), append
  only, so a case's history can never be rewritten (FR-WEB-029, BR-036).
- community.issue_evidence: report and case photos, sealed in the restricted evidence store and
  re-encoded without location data (ENT-11, FR-RPT-009, BR-033).
- community.issue_follow, issue_addition and issue_closure_response: following an issue, added
  information held for moderation, and the reporter's rating or challenge of a closure.

The PWA's npm.community_report table is left as it is; reports made there stay in the D01 queue.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = "('road', 'water', 'waste', 'electricity', 'agriculture', 'environment', 'public_facility', 'other')"
STAGES = "('gn', 'returned', 'ds', 'district', 'regional', 'executive', 'implementation', 'resolved', 'declined', 'linked')"
ACTIONS = (
    "('submitted', 'fact', 'finding', 'note', 'returned', 'reporter_replied', 'linked', 'forwarded', 'ds_report',"
    " 'district_action', 'escalated', 'regional_plan', 'executive_approved', 'executive_returned',"
    " 'executive_declined', 'assigned', 'progress', 'closed', 'challenged', 'challenge_rejected', 'reopened',"
    " 'public_summary', 'addition_moderated', 'breach_alerted')"
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA community")
    op.execute("CREATE SEQUENCE community.issue_number_seq")

    op.execute(
        f"""
        CREATE TABLE community.issue (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_number        text NOT NULL UNIQUE
                               DEFAULT ('CI-' || lpad(nextval('community.issue_number_seq')::text, 5, '0')),
            reporter_id        uuid NOT NULL REFERENCES npm.member (id),
            -- The app makes one per draft, so a second tap on Submit finds the first case (FR-RPT-013).
            client_reference   uuid NOT NULL,
            category           text NOT NULL CHECK (category IN {CATEGORIES}),
            title              text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
            description        text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 4000),
            location_kind      text NOT NULL CHECK (location_kind IN ('my_gn', 'landmark', 'text')),
            location_text      text CHECK (location_text IS NULL OR char_length(location_text) BETWEEN 3 AND 200),
            district_code      text REFERENCES geo.district (district_code),
            ds_code            text REFERENCES geo.ds_division (ds_code),
            gn_code            text REFERENCES geo.gn_division (gn_code),
            area_path          text[] NOT NULL,
            visibility         text NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'public')),
            stage              text NOT NULL DEFAULT 'gn' CHECK (stage IN {STAGES}),
            owner_id           uuid REFERENCES npm.member (id),
            stage_entered_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            stage_due_at       timestamptz,
            breach_alerted_at  timestamptz,
            parent_id          uuid REFERENCES community.issue (id),
            -- A public summary is written by a moderator and shown only once published (BR-032).
            public_state       text NOT NULL DEFAULT 'none'
                               CHECK (public_state IN ('none', 'pending', 'published', 'withheld')),
            public_title_en    text CHECK (public_title_en IS NULL OR char_length(public_title_en) BETWEEN 5 AND 120),
            public_title_ta    text CHECK (public_title_ta IS NULL OR char_length(public_title_ta) BETWEEN 5 AND 160),
            public_summary_en  text CHECK (public_summary_en IS NULL OR char_length(public_summary_en) BETWEEN 10 AND 1000),
            public_summary_ta  text CHECK (public_summary_ta IS NULL OR char_length(public_summary_ta) BETWEEN 10 AND 1500),
            published_at       timestamptz,
            implementation_due_at timestamptz,
            closed_at          timestamptz,
            closed_level       text CHECK (closed_level IS NULL OR closed_level IN ('district', 'executive')),
            closing_summary_en text,
            closing_summary_ta text,
            closure_round      integer NOT NULL DEFAULT 0,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT issue_one_per_draft UNIQUE (reporter_id, client_reference),
            CONSTRAINT issue_location_text CHECK (location_kind = 'my_gn' OR location_text IS NOT NULL),
            CONSTRAINT issue_published_needs_text CHECK (
                public_state <> 'published' OR (public_title_en IS NOT NULL AND public_title_ta IS NOT NULL
                    AND public_summary_en IS NOT NULL AND public_summary_ta IS NOT NULL)),
            CONSTRAINT issue_public_needs_consent CHECK (public_state IN ('none', 'withheld') OR visibility = 'public'),
            CONSTRAINT issue_linked_has_parent CHECK ((stage = 'linked') = (parent_id IS NOT NULL)),
            CONSTRAINT issue_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
        )
        """
    )
    op.execute("CREATE INDEX issue_reporter ON community.issue (reporter_id, created_at DESC)")
    op.execute("CREATE INDEX issue_area_path ON community.issue USING gin (area_path)")
    op.execute("CREATE INDEX issue_stage ON community.issue (stage, stage_due_at)")
    op.execute("CREATE INDEX issue_owner ON community.issue (owner_id) WHERE owner_id IS NOT NULL")
    op.execute("CREATE INDEX issue_parent ON community.issue (parent_id) WHERE parent_id IS NOT NULL")
    op.execute("CREATE INDEX issue_public_gn ON community.issue (gn_code, published_at DESC) WHERE public_state = 'published'")

    op.execute(
        f"""
        CREATE TABLE community.case_action (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            issue_id           uuid NOT NULL REFERENCES community.issue (id),
            kind               text NOT NULL CHECK (kind IN {ACTIONS}),
            actor_id           uuid REFERENCES npm.member (id),
            from_stage         text CHECK (from_stage IS NULL OR from_stage IN {STAGES}),
            to_stage           text CHECK (to_stage IS NULL OR to_stage IN {STAGES}),
            previous_owner_id  uuid REFERENCES npm.member (id),
            new_owner_id       uuid REFERENCES npm.member (id),
            note               text CHECK (note IS NULL OR char_length(note) <= 4000),
            details            jsonb NOT NULL DEFAULT '{{}}'::jsonb,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX case_action_issue ON community.case_action (issue_id, created_at)")
    # The history is the record of who decided what: nobody may edit or remove an entry.
    op.execute(
        """
        CREATE FUNCTION community.refuse_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'case history is append-only';
        END $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER case_action_append_only BEFORE UPDATE OR DELETE ON community.case_action
        FOR EACH ROW EXECUTE FUNCTION community.refuse_history_change()
        """
    )

    op.execute(
        """
        CREATE TABLE community.issue_addition (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            issue_id           uuid NOT NULL REFERENCES community.issue (id),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            body               text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 2000),
            -- The reporter answering a "return for details" (FR-WEB-016).
            is_reply           boolean NOT NULL DEFAULT false,
            state              text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected')),
            moderated_by       uuid REFERENCES npm.member (id),
            moderated_at       timestamptz,
            moderation_reason  text CHECK (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 3 AND 500),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT addition_rejection_reason CHECK (state <> 'rejected' OR moderation_reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX issue_addition_issue ON community.issue_addition (issue_id, created_at)")
    op.execute("CREATE INDEX issue_addition_pending ON community.issue_addition (created_at) WHERE state = 'pending'")

    op.execute(
        """
        CREATE TABLE community.issue_evidence (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            uploader_id  uuid NOT NULL REFERENCES npm.member (id),
            purpose      text NOT NULL CHECK (purpose IN ('report', 'addition', 'case')),
            issue_id     uuid REFERENCES community.issue (id),
            addition_id  uuid REFERENCES community.issue_addition (id),
            action_id    uuid REFERENCES community.case_action (id),
            sealed_with  text NOT NULL,
            byte_size    integer NOT NULL CHECK (byte_size > 0),
            width        integer NOT NULL,
            height       integer NOT NULL,
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX issue_evidence_issue ON community.issue_evidence (issue_id) WHERE issue_id IS NOT NULL")
    op.execute(
        "CREATE INDEX issue_evidence_unattached ON community.issue_evidence (uploader_id, created_at) WHERE issue_id IS NULL"
    )

    op.execute(
        """
        CREATE TABLE community.issue_follow (
            issue_id    uuid NOT NULL REFERENCES community.issue (id),
            member_id   uuid NOT NULL REFERENCES npm.member (id),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (issue_id, member_id)
        )
        """
    )
    op.execute("CREATE INDEX issue_follow_member ON community.issue_follow (member_id)")

    op.execute(
        """
        CREATE TABLE community.issue_closure_response (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            issue_id         uuid NOT NULL REFERENCES community.issue (id),
            member_id        uuid NOT NULL REFERENCES npm.member (id),
            closure_round    integer NOT NULL,
            resolved         boolean NOT NULL,
            rating           smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
            note             text CHECK (note IS NULL OR char_length(note) BETWEEN 5 AND 1000),
            state            text NOT NULL CHECK (state IN ('recorded', 'challenge_open', 'challenge_accepted', 'challenge_rejected')),
            decided_by       uuid REFERENCES npm.member (id),
            decided_at       timestamptz,
            decision_reason  text CHECK (decision_reason IS NULL OR char_length(decision_reason) BETWEEN 3 AND 1000),
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT closure_response_once UNIQUE (issue_id, member_id, closure_round),
            CONSTRAINT challenge_needs_note CHECK (resolved OR note IS NOT NULL),
            CONSTRAINT challenge_state CHECK ((state = 'recorded') = resolved)
        )
        """
    )
    op.execute(
        "CREATE INDEX issue_challenge_open ON community.issue_closure_response (created_at) WHERE state = 'challenge_open'"
    )


def downgrade() -> None:
    op.execute("DROP SCHEMA community CASCADE")
