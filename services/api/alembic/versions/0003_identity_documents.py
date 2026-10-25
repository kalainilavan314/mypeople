"""Identity document records; the images themselves stay in encrypted storage

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25

BRD v1.1 ENT-03 IdentityDocument, FR-REG-004/005 (NIC front and back, one
side replaceable), FR-ARCH-007 (private storage, signed URLs), BR-020 (only
server-acknowledged files count), BR-086 (every view logged).

- identity.identity_document: one row per uploaded image version. The image
  is never stored in the database; it is an AES-256-GCM encrypted file in the
  evidence store (see app/modules/identity/vault.py), named by this row's id.
  Replacing an image adds a new version and marks the old row superseded;
  nothing is deleted until the retention period is decided (OD-03).
- An index on the audit log for "who viewed my identity evidence" (FR-AUTH-024).

The BRD puts the identity vault in a separate database with its own
credentials (§13.8). Until hosting is decided (OD-20) the rows live in their
own schema here, and the images in a separate encrypted store.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA identity")
    op.execute(
        """
        CREATE TABLE identity.identity_document (
            -- Chosen by the API before the row exists: the encrypted file is
            -- named by it and its encryption is bound to it.
            id            uuid PRIMARY KEY,
            member_id     uuid NOT NULL REFERENCES npm.member (id),
            kind          text NOT NULL CHECK (kind IN ('nic_front', 'nic_back', 'passport_page', 'selfie')),
            version       integer NOT NULL CHECK (version >= 1),
            state         text NOT NULL DEFAULT 'current' CHECK (state IN ('current', 'superseded')),
            content_type  text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/heic')),
            byte_size     integer NOT NULL CHECK (byte_size > 0),
            -- Which encryption key sealed the file, so a key change can find
            -- the files still sealed with the old one.
            key_id        text NOT NULL,
            server_ack_at timestamptz NOT NULL DEFAULT now(),
            superseded_at timestamptz,
            CONSTRAINT identity_document_superseded CHECK ((state = 'superseded') = (superseded_at IS NOT NULL)),
            CONSTRAINT identity_document_version UNIQUE (member_id, kind, version)
        )
        """
    )
    # At most one current image of each kind per member.
    op.execute(
        "CREATE UNIQUE INDEX identity_document_current ON identity.identity_document (member_id, kind) "
        "WHERE state = 'current'"
    )
    op.execute(
        "CREATE INDEX audit_log_evidence_views ON ops.audit_log ((details->>'memberId')) "
        "WHERE action = 'identity.evidence.viewed'"
    )


def downgrade() -> None:
    # Production migrations are forward-only (docs/database/database-guide.md);
    # this exists for local development only.
    op.execute("DROP INDEX ops.audit_log_evidence_views")
    op.execute("DROP SCHEMA identity CASCADE")
