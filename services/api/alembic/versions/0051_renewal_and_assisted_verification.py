"""Membership renewal and certificates, and assisted identity verification (BRD v1.1 FR-RNW-001 to 009,
FR-IDV-014, FR-STF-004; screens M33, M34, D25, M05, S04; ENT-52, ENT-53).

Revision ID: 0051
Revises: 0045

- membership.renewal_cycle (ENT-52): one yearly reconfirmation of contact and area per member. Renewal
  never collects ID images or a selfie again (BR-136, FR-RNW-009): nothing here can hold one.
- membership.certificate (ENT-53): membership, event-participation and volunteer-service certificates
  with a revocable token, stored only as its hash (BR-137). They name the holder and never carry an
  NIC or passport number. A reissue supersedes the old certificate, which then verifies as such.
- membership.certificate_check: the public check page's rate limit (INT-22); only a hash of the
  caller's address and the time, removed after an hour.
- identity.assisted_request and identity.assisted_session: a member asks for help verifying (M05) and a
  trained coordinator or reviewer witnesses the capture on the member's own device (S04, OD-04). The
  request holds no ID data; the images still go only through the evidence vault, and the session only
  feeds the normal identity review, where a person with members.verify decides.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0051"
down_revision: str | None = "0050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE membership.renewal_cycle (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            due_on             date NOT NULL,
            opened_on          date NOT NULL,
            state              text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'confirmed', 'lapsed')),
            notice_30_at       timestamptz,
            notice_7_at        timestamptz,
            confirmed_at       timestamptz,
            area_confirmation  text CHECK (area_confirmation IN ('confirmed', 'change_requested')),
            lapsed_at          timestamptz,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT renewal_confirmed_has_time CHECK ((state = 'confirmed') = (confirmed_at IS NOT NULL)),
            CONSTRAINT renewal_confirmed_has_area CHECK ((state = 'confirmed') = (area_confirmation IS NOT NULL)),
            CONSTRAINT renewal_lapsed_has_time CHECK ((state = 'lapsed') = (lapsed_at IS NOT NULL))
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX renewal_one_open_cycle ON membership.renewal_cycle (member_id) WHERE state = 'open'")
    op.execute("CREATE INDEX renewal_open_due ON membership.renewal_cycle (due_on) WHERE state = 'open'")
    op.execute("CREATE INDEX renewal_member ON membership.renewal_cycle (member_id, created_at DESC)")

    op.execute("CREATE SEQUENCE membership.certificate_number_seq")
    op.execute(
        """
        CREATE TABLE membership.certificate (
            id                 uuid PRIMARY KEY,
            certificate_ref    text NOT NULL UNIQUE
                               DEFAULT ('CT-' || lpad(nextval('membership.certificate_number_seq')::text, 6, '0')),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            kind               text NOT NULL CHECK (kind IN ('membership', 'event_participation', 'volunteer_service')),
            -- The event for an event-participation certificate; empty otherwise.
            source_ref         text NOT NULL DEFAULT '',
            holder_name        text NOT NULL CHECK (char_length(holder_name) BETWEEN 1 AND 200),
            details            jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
            issued_on          date NOT NULL,
            -- NULL: the member asked for it in the app.
            issued_by          uuid REFERENCES npm.member (id),
            token_hash         text NOT NULL UNIQUE,
            status             text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked', 'superseded')),
            status_reason      text CHECK (status_reason IS NULL OR char_length(status_reason) BETWEEN 3 AND 500),
            status_changed_by  uuid REFERENCES npm.member (id),
            status_changed_at  timestamptz,
            superseded_by      uuid REFERENCES membership.certificate (id),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT certificate_change_has_reason CHECK (
                status = 'valid' OR (status_reason IS NOT NULL AND status_changed_at IS NOT NULL)),
            CONSTRAINT certificate_superseded_has_successor CHECK ((status = 'superseded') = (superseded_by IS NOT NULL))
        )
        """
    )
    op.execute(
        """CREATE UNIQUE INDEX certificate_one_valid ON membership.certificate (member_id, kind, source_ref)
           WHERE status = 'valid'"""
    )
    op.execute("CREATE INDEX certificate_member ON membership.certificate (member_id, created_at DESC)")
    op.execute(
        """
        CREATE TABLE membership.certificate_check (
            id           bigserial PRIMARY KEY,
            caller_hash  text NOT NULL,
            checked_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX certificate_check_recent ON membership.certificate_check (caller_hash, checked_at)")

    op.execute("CREATE SEQUENCE identity.assisted_request_number_seq")
    op.execute(
        """
        CREATE TABLE identity.assisted_request (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_ref     text NOT NULL UNIQUE
                            DEFAULT ('AV-' || lpad(nextval('identity.assisted_request_number_seq')::text, 5, '0')),
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            reason          text NOT NULL CHECK (reason IN ('no_camera', 'checks_failed', 'member_asked')),
            route           text NOT NULL CHECK (route IN ('supervised_capture', 'office_visit', 'call_back')),
            preferred_date  date,
            preferred_time  text CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
            area_path       text[] NOT NULL,
            state           text NOT NULL DEFAULT 'requested'
                            CHECK (state IN ('requested', 'scheduled', 'in_session', 'completed', 'cancelled', 'closed')),
            scheduled_for   timestamptz,
            meeting_place   text CHECK (meeting_place IS NULL OR char_length(meeting_place) BETWEEN 3 AND 200),
            scheduled_by    uuid REFERENCES npm.member (id),
            closed_reason   text CHECK (closed_reason IN ('member_declined', 'member_unreachable', 'verified_another_way')),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT assisted_scheduled_has_time CHECK (state <> 'scheduled' OR scheduled_for IS NOT NULL),
            CONSTRAINT assisted_closed_has_reason CHECK ((state = 'closed') = (closed_reason IS NOT NULL))
        )
        """
    )
    op.execute(
        """CREATE UNIQUE INDEX assisted_one_open_request ON identity.assisted_request (member_id)
           WHERE state IN ('requested', 'scheduled', 'in_session')"""
    )
    op.execute("CREATE INDEX assisted_request_area ON identity.assisted_request USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE identity.assisted_session (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id      uuid NOT NULL REFERENCES identity.assisted_request (id),
            witness_id      uuid NOT NULL REFERENCES npm.member (id),
            witness_tier    text NOT NULL,
            -- OD-04: the member's own device, or a district office's device; never a coordinator's phone.
            device          text NOT NULL CHECK (device IN ('member_device', 'office_device')),
            started_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            ended_at        timestamptz,
            outcome         text CHECK (outcome IN ('completed', 'abandoned')),
            checklist       text[] NOT NULL DEFAULT '{}',
            notes           text CHECK (notes IS NULL OR char_length(notes) <= 1000),
            abandon_reason  text CHECK (abandon_reason IN ('member_absent', 'camera_failure', 'document_missing',
                                                           'member_declined', 'other')),
            review_id       uuid REFERENCES identity.identity_review (id),
            CONSTRAINT assisted_session_ended CHECK ((ended_at IS NULL) = (outcome IS NULL)),
            CONSTRAINT assisted_session_completed CHECK (outcome IS DISTINCT FROM 'completed' OR review_id IS NOT NULL),
            CONSTRAINT assisted_session_abandoned CHECK ((outcome = 'abandoned') = (abandon_reason IS NOT NULL))
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX assisted_one_open_session ON identity.assisted_session (request_id) WHERE ended_at IS NULL"
    )
    op.execute("CREATE INDEX assisted_session_review ON identity.assisted_session (review_id) WHERE review_id IS NOT NULL")


def downgrade() -> None:
    op.execute("DROP TABLE identity.assisted_session")
    op.execute("DROP TABLE identity.assisted_request")
    op.execute("DROP SEQUENCE identity.assisted_request_number_seq")
    op.execute("DROP TABLE membership.certificate_check")
    op.execute("DROP TABLE membership.certificate")
    op.execute("DROP SEQUENCE membership.certificate_number_seq")
    op.execute("DROP TABLE membership.renewal_cycle")
