"""Feature flags, election periods and notices, manual check-in

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-26

BRD v1.1 FR-ARCH-011, NFR-ELC-01 to 03, 05, 08, FR-ELX-001, 004, 008, 010,
FR-VOI-007, BR-119, BR-129 to BR-131, BR-135, BR-144.

- ops.feature_flag: one row per v1.1 module, off until a Tier 5 records the
  phase gate and approval it needs and then turns it on (FR-ARCH-011);
  ops.feature_flag_change keeps every change, append-only.
- election.period: a declared election (type, area, period, silence window,
  polling day, the Election Commission source). Several may run at once,
  each with its own area and silence (NFR-ELC-05).
- election.notice: election information shown to members, labelled as
  Election Commission or Party information, with its source, document
  reference and publication time; withdrawn when superseded (NFR-ELC-06).
- events.attendance.method and manual_reason: a check-in by member ID when a
  pass cannot be scanned (FR-VOI-007), with the reason.
- notifications.broadcast.held_at: when a broadcast was first held back by a
  silence period, so the hold is recorded once (NFR-ELC-03).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ops.feature_flag (
            key              text PRIMARY KEY,
            enabled          boolean NOT NULL DEFAULT false,
            gate             text CHECK (gate IN ('G0', 'G1', 'G2', 'G3')),
            approval_ref     text CHECK (char_length(approval_ref) <= 200),
            gate_recorded_by uuid REFERENCES npm.member (id),
            gate_recorded_at timestamptz,
            updated_by       uuid REFERENCES npm.member (id),
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT feature_flag_gate CHECK ((gate IS NULL) = (gate_recorded_at IS NULL)),
            CONSTRAINT feature_flag_enabled_needs_gate CHECK (NOT enabled OR gate IS NOT NULL)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE ops.feature_flag_change (
            id          bigserial PRIMARY KEY,
            key         text NOT NULL REFERENCES ops.feature_flag (key),
            action      text NOT NULL CHECK (action IN ('gate_recorded', 'enabled', 'disabled')),
            gate        text,
            reason      text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
            changed_by  uuid NOT NULL REFERENCES npm.member (id),
            changed_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TRIGGER feature_flag_change_append_only BEFORE UPDATE OR DELETE ON ops.feature_flag_change
        FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()
        """
    )

    op.execute("CREATE SCHEMA election")
    op.execute("CREATE SEQUENCE election.period_ref_seq")
    op.execute(
        """
        CREATE TABLE election.period (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            period_ref          text NOT NULL UNIQUE
                                DEFAULT 'EP-' || lpad(nextval('election.period_ref_seq')::text, 4, '0'),
            election_type       text NOT NULL
                                CHECK (election_type IN ('presidential', 'parliamentary', 'provincial', 'local', 'referendum')),
            title_en            text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 160),
            title_ta            text NOT NULL CHECK (char_length(title_ta) BETWEEN 1 AND 160),
            area_key            text NOT NULL,
            area_path           text[] NOT NULL,
            starts_at           timestamptz NOT NULL,
            ends_at             timestamptz NOT NULL,
            silence_starts_at   timestamptz NOT NULL,
            silence_ends_at     timestamptz NOT NULL,
            polling_day         date NOT NULL,
            -- BR-129: dates come only from Election Commission publications, with source and time.
            source_url          text NOT NULL CHECK (source_url ~ '^https://'),
            source_reference    text NOT NULL CHECK (char_length(source_reference) BETWEEN 1 AND 200),
            source_published_at timestamptz NOT NULL,
            state               text NOT NULL DEFAULT 'declared' CHECK (state IN ('declared', 'ended', 'withdrawn')),
            declared_by         uuid NOT NULL REFERENCES npm.member (id),
            declared_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            closed_by           uuid REFERENCES npm.member (id),
            closed_at           timestamptz,
            close_reason        text CHECK (char_length(close_reason) BETWEEN 3 AND 500),
            CONSTRAINT period_closed CHECK ((state = 'declared') = (closed_at IS NULL AND close_reason IS NULL)),
            CONSTRAINT period_order CHECK (
                ends_at > starts_at AND silence_ends_at > silence_starts_at
                AND silence_starts_at >= starts_at AND silence_ends_at <= ends_at
            )
        )
        """
    )
    op.execute("CREATE INDEX period_area_path ON election.period USING gin (area_path)")
    op.execute(
        """
        CREATE TABLE election.notice (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            period_id           uuid NOT NULL REFERENCES election.period (id),
            -- FR-ELX-004: exactly one of the two labels.
            source              text NOT NULL CHECK (source IN ('election_commission', 'party')),
            title_en            text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 160),
            title_ta            text NOT NULL CHECK (char_length(title_ta) BETWEEN 1 AND 160),
            body_en             text NOT NULL CHECK (char_length(body_en) BETWEEN 1 AND 2000),
            body_ta             text NOT NULL CHECK (char_length(body_ta) BETWEEN 1 AND 2000),
            source_url          text CHECK (source_url ~ '^https://'),
            document_reference  text CHECK (char_length(document_reference) <= 200),
            source_published_at timestamptz,
            published_by        uuid NOT NULL REFERENCES npm.member (id),
            published_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            withdrawn_at        timestamptz,
            -- NFR-ELC-06: official information names its body, document and time.
            CONSTRAINT notice_official_source CHECK (
                source <> 'election_commission'
                OR (source_url IS NOT NULL AND document_reference IS NOT NULL AND source_published_at IS NOT NULL)
            )
        )
        """
    )
    op.execute(
        """
        ALTER TABLE events.attendance
            ADD COLUMN method text NOT NULL DEFAULT 'scan' CHECK (method IN ('scan', 'manual')),
            ADD COLUMN manual_reason text CHECK (char_length(manual_reason) <= 500),
            ADD CONSTRAINT attendance_manual_reason CHECK ((method = 'manual') = (manual_reason IS NOT NULL))
        """
    )
    op.execute("ALTER TABLE notifications.broadcast ADD COLUMN held_at timestamptz")


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("ALTER TABLE notifications.broadcast DROP COLUMN held_at")
    op.execute(
        "ALTER TABLE events.attendance DROP CONSTRAINT attendance_manual_reason, "
        "DROP COLUMN manual_reason, DROP COLUMN method"
    )
    op.execute("DROP SCHEMA election CASCADE")
    op.execute("DROP TABLE ops.feature_flag_change")
    op.execute("DROP TABLE ops.feature_flag")
