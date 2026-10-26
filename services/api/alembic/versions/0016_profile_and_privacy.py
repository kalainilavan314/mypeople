"""Display names, GN area-change requests and data-subject requests

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-26

BRD v1.1 FR-PROF-003, 005, 017 to 019, BR-073 to BR-076, BR-079.

- profile.display_name: the name a member chooses to be greeted by. It
  never replaces the legal name on npm.member, which stays locked (BR-074).
- profile.area_change: a request to move to another GN division, with proof
  of residence kept encrypted in the evidence vault (the database holds the
  record only). The member's area stays as it is until a reviewer in the
  requested area approves (BR-076). One open request per member; once
  decided, it is final.
- privacy.request: a request for a copy of one's personal data or to close
  the account (DSR- reference), due on a statutory date and handled by the
  DPO. One open request of each kind per member; once closed, it is final.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _final_once_decided(schema: str, table: str, open_states: str) -> None:
    op.execute(
        f"""
        CREATE FUNCTION {schema}.keep_{table}_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF OLD.state NOT IN ({open_states}) THEN
                RAISE EXCEPTION '{schema}.{table} % is decided and cannot change', OLD.request_ref;
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {table}_final BEFORE UPDATE ON {schema}.{table}
        FOR EACH ROW EXECUTE FUNCTION {schema}.keep_{table}_decision()
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {table}_no_delete BEFORE DELETE ON {schema}.{table}
        FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()
        """
    )


def upgrade() -> None:
    op.execute("CREATE SCHEMA profile")
    op.execute(
        """
        CREATE TABLE profile.display_name (
            member_id     uuid PRIMARY KEY REFERENCES npm.member (id),
            display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
            updated_at    timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE SEQUENCE profile.area_change_ref_seq")
    op.execute(
        """
        CREATE TABLE profile.area_change (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_ref     text NOT NULL UNIQUE
                            DEFAULT 'AC-' || lpad(nextval('profile.area_change_ref_seq')::text, 6, '0'),
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            from_gn         text,
            to_gn           text NOT NULL REFERENCES geo.gn_division (gn_code),
            -- The requested area and every area above it: reviewers there decide.
            area_path       text[] NOT NULL,
            proof_id        uuid,
            proof_key       text,
            proof_type      text CHECK (proof_type IN ('image/jpeg', 'image/png', 'image/heic')),
            state           text NOT NULL DEFAULT 'awaiting_proof'
                            CHECK (state IN ('awaiting_proof', 'submitted', 'approved', 'declined', 'withdrawn')),
            decision_reason text CHECK (char_length(decision_reason) <= 1000),
            decided_by      uuid REFERENCES npm.member (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            submitted_at    timestamptz,
            decided_at      timestamptz,
            CONSTRAINT area_change_proof CHECK ((proof_id IS NULL) = (proof_key IS NULL)),
            CONSTRAINT area_change_submitted CHECK (state = 'awaiting_proof' OR state = 'withdrawn' OR proof_id IS NOT NULL)
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX area_change_one_open ON profile.area_change (member_id) "
        "WHERE state IN ('awaiting_proof', 'submitted')"
    )
    op.execute("CREATE INDEX area_change_area_path ON profile.area_change USING gin (area_path)")
    _final_once_decided("profile", "area_change", "'awaiting_proof', 'submitted'")

    op.execute("CREATE SCHEMA privacy")
    op.execute("CREATE SEQUENCE privacy.request_ref_seq")
    op.execute(
        """
        CREATE TABLE privacy.request (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_ref   text NOT NULL UNIQUE DEFAULT 'DSR-' || lpad(nextval('privacy.request_ref_seq')::text, 6, '0'),
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            kind          text NOT NULL CHECK (kind IN ('copy', 'closure')),
            note          text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
            state         text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'completed', 'refused')),
            due_at        timestamptz NOT NULL,
            outcome_note  text CHECK (char_length(outcome_note) <= 2000),
            handled_by    uuid REFERENCES npm.member (id),
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            closed_at     timestamptz,
            CONSTRAINT request_closed CHECK ((state = 'open') = (closed_at IS NULL))
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX request_one_open ON privacy.request (member_id, kind) WHERE state = 'open'")
    op.execute("CREATE INDEX request_open_due ON privacy.request (due_at) WHERE state = 'open'")
    _final_once_decided("privacy", "request", "'open'")


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP SCHEMA privacy CASCADE")
    op.execute("DROP SCHEMA profile CASCADE")
