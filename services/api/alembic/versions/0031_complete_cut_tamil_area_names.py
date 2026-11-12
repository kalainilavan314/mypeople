"""Complete the Tamil area names that the geography import cut short.

Revision ID: 0031
Revises: 0030

The GIS source stored names in 50-byte attribute fields, so the Tamil names of
three districts and two DS divisions lost their last letters on import
(server/migrations/0000_geo_reference.sql, for example "யாழ்ப்பாணம் மாவட்").
That Express migration is left as it is, because its checksum is recorded as
applied. Each update here matches the cut value exactly, so a database that
already holds the full name, or a different one, is not touched.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, code column, code, name as imported, full name)
CORRECTIONS: tuple[tuple[str, str, str, str, str], ...] = (
    ("geo.district", "district_code", "LK41", "யாழ்ப்பாணம் மாவட்", "யாழ்ப்பாணம் மாவட்டம்"),
    ("geo.district", "district_code", "LK44", "முல்லைத்தீவு மாவட", "முல்லைத்தீவு மாவட்டம்"),
    ("geo.district", "district_code", "LK45", "கிளிநொச்சி மாவட்ட", "கிளிநொச்சி மாவட்டம்"),
    ("geo.ds_division", "ds_code", "LK4312", "வெங்கலச்செட்டிக்", "வெங்கலச்செட்டிக்குளம்"),
    ("geo.ds_division", "ds_code", "LK4409", "புதுக்குடியிருப்", "புதுக்குடியிருப்பு"),
)


def upgrade() -> None:
    for table, column, code, cut, full in CORRECTIONS:
        op.execute(
            sa.text(f"UPDATE {table} SET name_ta = :full WHERE {column} = :code AND name_ta = :cut").bindparams(
                full=full, code=code, cut=cut
            )
        )


def downgrade() -> None:
    # The cut names were an import fault that nothing depends on, so going back keeps the full names.
    pass
