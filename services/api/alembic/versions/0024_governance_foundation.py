"""Versioned policy evidence and append-only member acknowledgements.

Revision ID: 0024
Revises: 0023

MP-DEC-001 M1.6: a privacy-notice acknowledgement and optional consent have
different legal bases. No policy is published by this migration.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA governance")
    op.execute(
        """
        CREATE TABLE governance.policy_version (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            policy_key text NOT NULL CHECK (char_length(policy_key) BETWEEN 1 AND 80),
            policy_type text NOT NULL CHECK (policy_type IN ('privacy_notice', 'terms', 'optional_consent', 'election_rule')),
            version text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 40),
            locale text NOT NULL CHECK (locale IN ('en', 'ta')),
            content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
            content_text text NOT NULL CHECK (char_length(content_text) > 0),
            approved_by uuid NOT NULL REFERENCES npm.member(id),
            approved_at timestamptz NOT NULL,
            effective_from timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (policy_key, version, locale)
        )
        """
    )
    op.execute("CREATE INDEX policy_current ON governance.policy_version (policy_key, locale, effective_from DESC)")
    op.execute(
        """
        CREATE TABLE governance.consent_event (
            id bigserial PRIMARY KEY,
            member_id uuid NOT NULL REFERENCES npm.member(id),
            policy_version_id uuid NOT NULL REFERENCES governance.policy_version(id),
            action text NOT NULL CHECK (action IN ('acknowledged', 'granted', 'withdrawn')),
            legal_basis text NOT NULL CHECK (char_length(legal_basis) BETWEEN 1 AND 80),
            -- Staff-assisted consent is reserved until OD-04 defines delegated authority.
            channel text NOT NULL CHECK (channel = 'member_mobile'),
            occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            actor_id uuid NOT NULL REFERENCES npm.member(id),
            CHECK (action <> 'withdrawn' OR member_id = actor_id)
        )
        """
    )
    op.execute("CREATE INDEX consent_member_history ON governance.consent_event (member_id, id DESC)")
    op.execute("CREATE INDEX consent_policy_history ON governance.consent_event (policy_version_id, id DESC)")
    op.execute(
        """
        CREATE FUNCTION governance.validate_consent_event() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE policy_kind text;
        DECLARE effective_at timestamptz;
        DECLARE approved_at_time timestamptz;
        BEGIN
            SELECT policy_type, effective_from, approved_at
              INTO policy_kind, effective_at, approved_at_time
              FROM governance.policy_version WHERE id = NEW.policy_version_id;
            IF policy_kind IS NULL OR effective_at > clock_timestamp() OR approved_at_time > clock_timestamp() THEN
                RAISE EXCEPTION 'policy_not_effective';
            END IF;
            IF (policy_kind = 'optional_consent') <> (NEW.action IN ('granted', 'withdrawn')) THEN
                RAISE EXCEPTION 'invalid_policy_action';
            END IF;
            IF NEW.actor_id <> NEW.member_id THEN
                RAISE EXCEPTION 'member_action_required';
            END IF;
            RETURN NEW;
        END $$
        """
    )
    op.execute(
        "CREATE TRIGGER consent_event_validate BEFORE INSERT ON governance.consent_event "
        "FOR EACH ROW EXECUTE FUNCTION governance.validate_consent_event()"
    )
    for table in ("policy_version", "consent_event"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON governance.{table} "
            "FOR EACH ROW EXECUTE FUNCTION ops.refuse_change()"
        )
        op.execute(
            f"CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON governance.{table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION ops.refuse_change()"
        )


def downgrade() -> None:
    raise RuntimeError("Governance evidence requires a reviewed preservation plan; automatic downgrade is refused")
