"""Field visit counts keep their place and area path (FR-FLD-009, D24).

Revision ID: 0044
Revises: 0043

A visit's place is now a GN, a DS or none (0042), so a kept monthly count is keyed by an area key
('gn:...', 'ds:...', or the coordinator's area) instead of a bare GN code, and carries the area path
supervisors are checked against.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0044"
down_revision: str | None = "0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The table is under forced row-level security (0042); open it for this migration's transaction.
    op.execute("SELECT set_config('field.firewall', 'open', true)")
    op.execute("ALTER TABLE field.visit_count RENAME COLUMN gn_code TO place_key")
    op.execute("ALTER TABLE field.visit_count ADD COLUMN area_path text[]")
    op.execute(
        """
        UPDATE field.visit_count k
        SET place_key = 'gn:' || k.place_key,
            area_path = ARRAY['platform', 'province:' || d.province_code, 'district:' || d.district_code,
                              'ds:' || g.ds_code, 'gn:' || g.gn_code]
        FROM geo.gn_division g
        JOIN geo.ds_division s ON s.ds_code = g.ds_code
        JOIN geo.district d ON d.district_code = s.district_code
        WHERE position(':' IN k.place_key) = 0 AND g.gn_code = k.place_key
        """
    )
    op.execute("UPDATE field.visit_count SET area_path = ARRAY['platform', place_key] WHERE area_path IS NULL")
    op.execute("ALTER TABLE field.visit_count ALTER COLUMN area_path SET NOT NULL")
    op.execute("CREATE INDEX visit_count_area ON field.visit_count USING gin (area_path)")


def downgrade() -> None:
    op.execute("SELECT set_config('field.firewall', 'open', true)")
    op.execute("DROP INDEX field.visit_count_area")
    op.execute("ALTER TABLE field.visit_count DROP COLUMN area_path")
    op.execute("UPDATE field.visit_count SET place_key = split_part(place_key, ':', 2) WHERE place_key LIKE 'gn:%'")
    op.execute("ALTER TABLE field.visit_count RENAME COLUMN place_key TO gn_code")
