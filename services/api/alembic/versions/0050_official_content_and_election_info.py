"""Official content: approved publishers, signing keys, signed statements and their revisions
(BRD v1.1 FR-AUT-001 to 005, BR-148, BR-150, ENT-60, INT-22, INT-24; screens M47, M48 check part, D30).

Revision ID: 0050
Revises: 0045

Tier 5 registers approved publisher identities. A registered publisher signs each statement (and
its image, by the image's SHA-256) with the platform's Ed25519 key and publishes it with a public
check code. A correction is a new signed revision appended to the statement; earlier revisions are
never changed or deleted (BR-150), which triggers enforce. The public part of every key that has
signed anything is kept here, so statements signed before a key rotation still verify.

[ASSUMPTION] INT-24: one platform key held as a server setting until a KMS is chosen; each signed
payload names the publisher. Election information (M29) needs no table: it reads the election
periods and notices of 0018.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0050"
down_revision: str | None = "0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Crockford base32 without I, L, O and U, so a code read aloud or retyped is not misread.
CHECK_CODE = r"^TMK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE content.signing_key (
            key_id         text PRIMARY KEY CHECK (key_id ~ '^ed25519:[0-9a-f]{16}$'),
            algorithm      text NOT NULL CHECK (algorithm = 'ed25519'),
            public_key     text NOT NULL UNIQUE CHECK (char_length(public_key) = 44),
            first_used_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE content.official_publisher (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id      uuid NOT NULL REFERENCES npm.member (id),
            name_en        text NOT NULL CHECK (char_length(name_en) BETWEEN 2 AND 120),
            name_ta        text NOT NULL CHECK (char_length(name_ta) BETWEEN 2 AND 120),
            state          text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked')),
            registered_by  uuid NOT NULL REFERENCES npm.member (id),
            registered_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            revoked_by     uuid REFERENCES npm.member (id),
            revoked_at     timestamptz,
            revoke_reason  text CHECK (revoke_reason IS NULL OR char_length(revoke_reason) BETWEEN 3 AND 500),
            CONSTRAINT publisher_registered_by_someone_else CHECK (registered_by <> member_id),
            CONSTRAINT publisher_revoked_has_reason
                CHECK (state = 'active' OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revoke_reason IS NOT NULL))
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX official_publisher_one_active ON content.official_publisher (member_id) WHERE state = 'active'"
    )
    op.execute(
        """
        CREATE TABLE content.official_image (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            uploaded_by  uuid NOT NULL REFERENCES npm.member (id),
            sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
            byte_size    integer NOT NULL CHECK (byte_size > 0),
            width        integer NOT NULL CHECK (width > 0),
            height       integer NOT NULL CHECK (height > 0),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE SEQUENCE content.official_statement_seq")
    op.execute(
        f"""
        CREATE TABLE content.official_statement (
            id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            statement_ref         text NOT NULL UNIQUE
                                  DEFAULT ('OS-' || lpad(nextval('content.official_statement_seq')::text, 5, '0')),
            check_code            text UNIQUE CHECK (check_code IS NULL OR check_code ~ '{CHECK_CODE}'),
            state                 text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'withdrawn')),
            draft_title_en        text NOT NULL DEFAULT '' CHECK (char_length(draft_title_en) <= 200),
            draft_title_ta        text NOT NULL DEFAULT '' CHECK (char_length(draft_title_ta) <= 200),
            draft_body_en         text NOT NULL DEFAULT '' CHECK (char_length(draft_body_en) <= 5000),
            draft_body_ta         text NOT NULL DEFAULT '' CHECK (char_length(draft_body_ta) <= 6000),
            draft_image_id        uuid REFERENCES content.official_image (id),
            created_by            uuid NOT NULL REFERENCES npm.member (id),
            created_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
            withdrawn_by          uuid REFERENCES npm.member (id),
            withdrawn_at          timestamptz,
            withdrawal_reason_en  text CHECK (withdrawal_reason_en IS NULL OR char_length(withdrawal_reason_en) BETWEEN 3 AND 1000),
            withdrawal_reason_ta  text CHECK (withdrawal_reason_ta IS NULL OR char_length(withdrawal_reason_ta) BETWEEN 3 AND 1200),
            CONSTRAINT statement_published_has_code CHECK (state = 'draft' OR check_code IS NOT NULL),
            CONSTRAINT statement_withdrawn_has_reason CHECK (
                state <> 'withdrawn'
                OR (withdrawn_at IS NOT NULL AND withdrawn_by IS NOT NULL
                    AND withdrawal_reason_en IS NOT NULL AND withdrawal_reason_ta IS NOT NULL)
            )
        )
        """
    )
    op.execute(
        """
        CREATE TABLE content.official_revision (
            id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            statement_id          uuid NOT NULL REFERENCES content.official_statement (id),
            revision              integer NOT NULL CHECK (revision >= 1),
            title_en              text NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 200),
            title_ta              text NOT NULL CHECK (char_length(title_ta) BETWEEN 1 AND 200),
            body_en               text NOT NULL CHECK (char_length(body_en) BETWEEN 1 AND 5000),
            body_ta               text NOT NULL CHECK (char_length(body_ta) BETWEEN 1 AND 6000),
            image_id              uuid REFERENCES content.official_image (id),
            image_sha256          text CHECK (image_sha256 IS NULL OR image_sha256 ~ '^[0-9a-f]{64}$'),
            correction_reason_en  text CHECK (correction_reason_en IS NULL OR char_length(correction_reason_en) BETWEEN 3 AND 1000),
            correction_reason_ta  text CHECK (correction_reason_ta IS NULL OR char_length(correction_reason_ta) BETWEEN 3 AND 1200),
            publisher_id          uuid NOT NULL REFERENCES content.official_publisher (id),
            key_id                text NOT NULL REFERENCES content.signing_key (key_id),
            signed_payload        text NOT NULL,
            signature             text NOT NULL CHECK (char_length(signature) = 88),
            published_at          timestamptz NOT NULL,
            UNIQUE (statement_id, revision),
            CONSTRAINT revision_image_has_hash CHECK ((image_id IS NULL) = (image_sha256 IS NULL)),
            CONSTRAINT revision_correction_has_reason CHECK (
                (revision = 1 AND correction_reason_en IS NULL AND correction_reason_ta IS NULL)
                OR (revision > 1 AND correction_reason_en IS NOT NULL AND correction_reason_ta IS NOT NULL)
            )
        )
        """
    )
    op.execute("CREATE INDEX official_statement_published ON content.official_statement (state, updated_at DESC)")
    # BR-150: a published revision is the record; corrections are new revisions, never edits.
    # identity.refuse_change() is the shared "cannot be changed or deleted" trigger function (0004).
    for table in ("official_revision", "signing_key"):
        op.execute(
            f"CREATE TRIGGER {table}_no_update_or_delete BEFORE UPDATE OR DELETE ON content.{table} "
            "FOR EACH ROW EXECUTE FUNCTION identity.refuse_change()"
        )
        op.execute(
            f"CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON content.{table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION identity.refuse_change()"
        )


def downgrade() -> None:
    op.execute("DROP TABLE content.official_revision")
    op.execute("DROP TABLE content.official_statement")
    op.execute("DROP SEQUENCE content.official_statement_seq")
    op.execute("DROP TABLE content.official_image")
    op.execute("DROP TABLE content.official_publisher")
    op.execute("DROP TABLE content.signing_key")
