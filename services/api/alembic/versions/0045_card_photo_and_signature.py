"""The member card's photo and the member's drawn signature (owner's card design, 17 November 2026).

Revision ID: 0045
Revises: 0044

A member may add a photo to their card and draw their signature on it. The photo is a voluntary
upload of its own, never the identity selfie or document photos (BR-021): it is re-encoded without
metadata and sealed with the evidence key in its own folder, so this table holds only which file
and which key. The signature is the strokes the member drew, as points scaled to 0..1 of the pad.
Both belong to the member, who may replace or remove them at any time.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0045"
down_revision: str | None = "0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE profile.card_photo (
            member_id    uuid PRIMARY KEY REFERENCES npm.member (id),
            photo_id     uuid NOT NULL UNIQUE,
            sealed_with  text NOT NULL,
            width        integer NOT NULL CHECK (width > 0),
            height       integer NOT NULL CHECK (height > 0),
            updated_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE profile.card_signature (
            member_id   uuid PRIMARY KEY REFERENCES npm.member (id),
            strokes     jsonb NOT NULL
                        CHECK (jsonb_typeof(strokes) = 'array' AND jsonb_array_length(strokes) BETWEEN 1 AND 40),
            updated_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE profile.card_signature")
    op.execute("DROP TABLE profile.card_photo")
