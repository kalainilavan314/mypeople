"""Volunteer duties, registered devices and provisional offline scan events.

Revision ID: 0023
Revises: 0022

MP-DEC-001 M1.5: an offline scan is never final attendance until the server
validates it. These tables do not enable offline use or role grants.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA staff_ops")
    op.execute(
        """
        CREATE TABLE staff_ops.volunteer_assignment (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id uuid NOT NULL REFERENCES npm.member(id),
            event_id uuid NOT NULL REFERENCES events.event(id),
            consent_version text NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 40),
            duty_type text NOT NULL CHECK (duty_type IN (
                'registration', 'scanning', 'member_assistance', 'accessibility_support',
                'logistics', 'coordination', 'administration'
            )),
            area_key text NOT NULL CHECK (char_length(area_key) BETWEEN 3 AND 60),
            assigned_by uuid NOT NULL REFERENCES npm.member(id),
            shift_start timestamptz NOT NULL,
            shift_end timestamptz NOT NULL,
            state text NOT NULL DEFAULT 'offered' CHECK (state IN (
                'offered', 'accepted', 'declined', 'cancelled', 'completed'
            )),
            acknowledged_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            CHECK (shift_end > shift_start),
            UNIQUE (member_id, event_id, duty_type, shift_start)
        )
        """
    )
    op.execute("CREATE INDEX volunteer_assignment_event_idx ON staff_ops.volunteer_assignment (event_id, shift_start)")
    op.execute("CREATE INDEX volunteer_assignment_member ON staff_ops.volunteer_assignment (member_id, shift_start DESC)")
    op.execute(
        """
        CREATE TABLE staff_ops.volunteer_assignment_event (
            id bigserial PRIMARY KEY,
            assignment_id uuid NOT NULL REFERENCES staff_ops.volunteer_assignment(id),
            from_state text,
            to_state text NOT NULL,
            actor_id uuid NOT NULL REFERENCES npm.member(id),
            reason text CHECK (reason IS NULL OR char_length(reason) BETWEEN 3 AND 1000),
            occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX volunteer_assignment_history ON staff_ops.volunteer_assignment_event (assignment_id, id)")
    op.execute(
        """
        CREATE TABLE staff_ops.registered_device (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_member_id uuid NOT NULL REFERENCES npm.member(id),
            device_key_hash text NOT NULL UNIQUE CHECK (device_key_hash ~ '^[0-9a-f]{64}$'),
            label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
            registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            revoked_at timestamptz,
            revoked_by uuid REFERENCES npm.member(id),
            CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX registered_device_staff ON staff_ops.registered_device (staff_member_id)")
    op.execute(
        """
        CREATE TABLE staff_ops.scan_event (
            id uuid PRIMARY KEY,
            idempotency_key uuid NOT NULL UNIQUE,
            event_id uuid NOT NULL REFERENCES events.event(id),
            device_id uuid NOT NULL REFERENCES staff_ops.registered_device(id),
            scanner_staff_id uuid NOT NULL REFERENCES npm.member(id),
            -- Opaque code only. Never store a photo, NIC or biometric payload.
            pass_code text NOT NULL CHECK (char_length(pass_code) BETWEEN 1 AND 1024),
            client_scan_at timestamptz NOT NULL,
            server_received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            local_outcome text NOT NULL CHECK (char_length(local_outcome) BETWEEN 1 AND 40),
            status text NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK (status IN (
                'ACCEPTED', 'DUPLICATE', 'REJECTED', 'NEEDS_REVIEW', 'EXPIRED_QUEUE'
            )),
            attendance_member_id uuid REFERENCES npm.member(id),
            reason text CHECK (reason IS NULL OR char_length(reason) BETWEEN 3 AND 1000)
        )
        """
    )
    op.execute("CREATE INDEX scan_event_queue ON staff_ops.scan_event (event_id, status, server_received_at)")
    op.execute(
        """
        CREATE TABLE staff_ops.scan_event_decision (
            id bigserial PRIMARY KEY,
            scan_event_id uuid NOT NULL REFERENCES staff_ops.scan_event(id),
            decision text NOT NULL CHECK (decision IN ('accepted', 'rejected', 'corrected')),
            reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
            decided_by uuid NOT NULL REFERENCES npm.member(id),
            decided_at timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    for table in ("volunteer_assignment_event", "scan_event_decision"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON staff_ops.{table} "
            "FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()"
        )


def downgrade() -> None:
    raise RuntimeError("Staff attendance and assignment history require a reviewed preservation plan")
