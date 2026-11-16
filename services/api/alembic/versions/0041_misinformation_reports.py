"""Misinformation reports and the fact-check queue (BRD v1.1 FR-AUT-006 to 009; screens M48 reporting part, D12).

Revision ID: 0041
Revises: 0040

Members report suspected misinformation with a link or a screenshot; a person decides each report
with a reason and the reporter may appeal once, decided by someone else (BR-149). No AI score is
stored or shown. Checking a statement against its signed original (FR-AUT-005) waits for the
signing keys (INT-24).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0041"
down_revision: str | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OUTCOMES = "('false', 'misleading', 'accurate', 'not_actionable')"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE community.misinfo_screenshot (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            uploader_id  uuid NOT NULL REFERENCES npm.member (id),
            sealed_with  text NOT NULL,
            byte_size    integer NOT NULL CHECK (byte_size > 0),
            width        integer NOT NULL,
            height       integer NOT NULL,
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE SEQUENCE community.misinfo_number_seq")
    op.execute(
        f"""
        CREATE TABLE community.misinfo_report (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            report_ref         text NOT NULL UNIQUE DEFAULT ('MR-' || lpad(nextval('community.misinfo_number_seq')::text, 5, '0')),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            link               text CHECK (link IS NULL OR (link ~ '^https?://' AND char_length(link) <= 1000)),
            description        text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
            screenshot_id      uuid UNIQUE REFERENCES community.misinfo_screenshot (id),
            state              text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'decided')),
            outcome            text CHECK (outcome IS NULL OR outcome IN {OUTCOMES}),
            reason             text CHECK (reason IS NULL OR char_length(reason) BETWEEN 10 AND 2000),
            decided_by         uuid REFERENCES npm.member (id),
            decided_at         timestamptz,
            appeal_body        text CHECK (appeal_body IS NULL OR char_length(appeal_body) BETWEEN 10 AND 1000),
            appeal_state       text NOT NULL DEFAULT 'none' CHECK (appeal_state IN ('none', 'open', 'upheld', 'changed')),
            appeal_outcome     text CHECK (appeal_outcome IS NULL OR appeal_outcome IN {OUTCOMES}),
            appeal_reason      text CHECK (appeal_reason IS NULL OR char_length(appeal_reason) BETWEEN 10 AND 2000),
            appeal_decided_by  uuid REFERENCES npm.member (id),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT report_has_evidence CHECK (link IS NOT NULL OR screenshot_id IS NOT NULL),
            CONSTRAINT decided_has_reason CHECK (state = 'pending' OR (outcome IS NOT NULL AND reason IS NOT NULL)),
            CONSTRAINT appeal_by_someone_else CHECK (appeal_decided_by IS NULL OR appeal_decided_by <> decided_by)
        )
        """
    )
    op.execute("CREATE INDEX misinfo_queue ON community.misinfo_report (created_at) WHERE state = 'pending' OR appeal_state = 'open'")


def downgrade() -> None:
    op.execute("DROP TABLE community.misinfo_report")
    op.execute("DROP TABLE community.misinfo_screenshot")
    op.execute("DROP SEQUENCE community.misinfo_number_seq")
