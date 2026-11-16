"""Learning courses and member invitations (BRD v1.1 FR-LRN-001 to 004, FR-REF-001 to 006; H15, H16, H19, H20).

Revision ID: 0036
Revises: 0035

- community.course, course_lesson, lesson_completion and course_progress: short courses whose
  progress is recorded only when the member taps "Complete lesson", with the lesson to resume
  after "Save and exit". Completing a course never changes verification, role or authority.
- membership.invitation: an invitation link carries only an opaque random token, never a NIC,
  passport or name (FR-REF-004); its status is only Shared, Pending or Active, derived from the
  invitee's membership (FR-REF-005). Referral counts never become permissions or rewards.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE community.course_number_seq")
    op.execute(
        """
        CREATE TABLE community.course (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            course_ref    text NOT NULL UNIQUE DEFAULT ('LC-' || lpad(nextval('community.course_number_seq')::text, 3, '0')),
            title_en      text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 120),
            title_ta      text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 160),
            summary_en    text NOT NULL CHECK (char_length(summary_en) BETWEEN 10 AND 600),
            summary_ta    text NOT NULL CHECK (char_length(summary_ta) BETWEEN 10 AND 900),
            topic         text NOT NULL CHECK (topic IN ('movement', 'civic', 'app', 'skills')),
            state         text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'retired')),
            created_by    uuid NOT NULL REFERENCES npm.member (id),
            published_at  timestamptz,
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at    timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE community.course_lesson (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            course_id  uuid NOT NULL REFERENCES community.course (id) ON DELETE CASCADE,
            position   integer NOT NULL CHECK (position BETWEEN 1 AND 50),
            title_en   text NOT NULL CHECK (char_length(title_en) BETWEEN 3 AND 120),
            title_ta   text NOT NULL CHECK (char_length(title_ta) BETWEEN 3 AND 160),
            body_en    text NOT NULL CHECK (char_length(body_en) BETWEEN 20 AND 12000),
            body_ta    text NOT NULL CHECK (char_length(body_ta) BETWEEN 20 AND 18000),
            minutes    integer NOT NULL CHECK (minutes BETWEEN 1 AND 120),
            UNIQUE (course_id, position)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE community.course_progress (
            course_id        uuid NOT NULL REFERENCES community.course (id),
            member_id        uuid NOT NULL REFERENCES npm.member (id),
            resume_position  integer NOT NULL DEFAULT 1,
            started_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            completed_at     timestamptz,
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (course_id, member_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE community.lesson_completion (
            lesson_id     uuid NOT NULL REFERENCES community.course_lesson (id) ON DELETE CASCADE,
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            completed_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (lesson_id, member_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE membership.invitation (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            -- Random and meaningless: the only thing the shared link carries (FR-REF-004).
            token       text NOT NULL UNIQUE CHECK (token ~ '^INV-[A-Z2-7]{12}$'),
            inviter_id  uuid NOT NULL REFERENCES npm.member (id),
            number      integer NOT NULL,
            invitee_id  uuid UNIQUE REFERENCES npm.member (id),
            language    text NOT NULL CHECK (language IN ('ta', 'en')),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            joined_at   timestamptz,
            UNIQUE (inviter_id, number),
            CONSTRAINT invitation_not_self CHECK (invitee_id IS NULL OR invitee_id <> inviter_id)
        )
        """
    )
    op.execute("CREATE INDEX invitation_inviter ON membership.invitation (inviter_id, number)")


def downgrade() -> None:
    op.execute("DROP TABLE membership.invitation")
    for table in ("lesson_completion", "course_progress", "course_lesson", "course"):
        op.execute(f"DROP TABLE community.{table}")
    op.execute("DROP SEQUENCE community.course_number_seq")
