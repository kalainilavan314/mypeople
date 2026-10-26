"""In-app notifications, push devices, channel preferences and staff broadcasts

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-26

BRD v1.1 FR-HOME-009 to 011, FR-REG-021, FR-ADM-007, FR-STF-009,
FR-PROF-012, FR-MSG-004, 007, 008, BR-027, BR-145, BR-146; AP-08 (outbox).

- notifications.notification: one item in a member's inbox (H03), written in
  the same transaction as the change it reports, so it is never lost or
  sent for a change that did not happen. It is also the push outbox: a
  dispatcher sends the pending ones. read_at and action_done_at are
  separate (BR-027): an item needing action stays under "Action needed"
  until the task is done, read or not.
- notifications.device: push tokens of the member's phones and browsers.
- notifications.preference and notifications.setting: push and SMS per
  topic, and quiet hours. Account and review notices cannot be turned off.
- notifications.broadcast: a staff announcement (NB- reference) to an area,
  previewed, scheduled, approved above district scope, then sent.
- content.removal_request.escalated_at: when Tier 5 was alerted about a
  request still open after 18 hours (FR-ADM-006).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TOPICS = "('account', 'review', 'events', 'announcements', 'emergency')"


def upgrade() -> None:
    op.execute("CREATE SCHEMA notifications")
    op.execute("CREATE SEQUENCE notifications.broadcast_ref_seq")
    op.execute(
        f"""
        CREATE TABLE notifications.broadcast (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            broadcast_ref text NOT NULL UNIQUE
                          DEFAULT 'NB-' || lpad(nextval('notifications.broadcast_ref_seq')::text, 6, '0'),
            topic         text NOT NULL CHECK (topic IN ('announcements', 'emergency')),
            title_en      text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 80),
            title_ta      text NOT NULL CHECK (char_length(title_ta) BETWEEN 1 AND 80),
            body_en       text NOT NULL CHECK (char_length(body_en) BETWEEN 1 AND 1000),
            body_ta       text NOT NULL CHECK (char_length(body_ta) BETWEEN 1 AND 1000),
            area_level    text NOT NULL,
            area_key      text NOT NULL,
            area_path     text[] NOT NULL,
            state         text NOT NULL DEFAULT 'draft'
                          CHECK (state IN ('draft', 'pending_approval', 'scheduled', 'sent', 'cancelled')),
            send_at       timestamptz,
            created_by    uuid NOT NULL REFERENCES npm.member (id),
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            submitted_by  uuid REFERENCES npm.member (id),
            approved_by   uuid REFERENCES npm.member (id),
            sent_at       timestamptz,
            recipients    integer
        )
        """
    )
    op.execute("CREATE INDEX broadcast_due ON notifications.broadcast (send_at) WHERE state = 'scheduled'")
    op.execute(
        f"""
        CREATE TABLE notifications.notification (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            topic           text NOT NULL CHECK (topic IN {TOPICS}),
            template        text NOT NULL,
            title_en        text NOT NULL,
            title_ta        text NOT NULL,
            body_en         text NOT NULL DEFAULT '',
            body_ta         text NOT NULL DEFAULT '',
            -- What the item opens (BR-027): a kind of record and its id.
            target_kind     text NOT NULL,
            target_id       uuid,
            action_required boolean NOT NULL DEFAULT false,
            action_done_at  timestamptz,
            urgent          boolean NOT NULL DEFAULT false,
            broadcast_id    uuid REFERENCES notifications.broadcast (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            read_at         timestamptz,
            push_state      text NOT NULL DEFAULT 'pending' CHECK (push_state IN ('pending', 'sent', 'skipped')),
            pushed_at       timestamptz
        )
        """
    )
    op.execute("CREATE INDEX notification_member_recent ON notifications.notification (member_id, created_at DESC)")
    op.execute(
        "CREATE INDEX notification_push_pending ON notifications.notification (created_at) WHERE push_state = 'pending'"
    )
    op.execute(
        """
        CREATE TABLE notifications.device (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            token         text NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 10 AND 4096),
            platform      text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            last_seen_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            revoked_at    timestamptz
        )
        """
    )
    op.execute("CREATE INDEX device_member ON notifications.device (member_id) WHERE revoked_at IS NULL")
    op.execute(
        f"""
        CREATE TABLE notifications.preference (
            member_id  uuid NOT NULL REFERENCES npm.member (id),
            topic      text NOT NULL CHECK (topic IN {TOPICS}),
            push       boolean NOT NULL,
            sms        boolean NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (member_id, topic)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE notifications.setting (
            member_id    uuid PRIMARY KEY REFERENCES npm.member (id),
            quiet_start  time,
            quiet_end    time,
            updated_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT setting_quiet_pair CHECK ((quiet_start IS NULL) = (quiet_end IS NULL))
        )
        """
    )
    # Marking a request as escalated is the one change allowed while it is open, so the
    # trigger that keeps decisions final still applies.
    op.execute("ALTER TABLE content.removal_request ADD COLUMN escalated_at timestamptz")


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("ALTER TABLE content.removal_request DROP COLUMN escalated_at")
    op.execute("DROP SCHEMA notifications CASCADE")
