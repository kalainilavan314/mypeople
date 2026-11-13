"""Area snapshot and operational queue indexes for community reports.

Revision ID: 0025
Revises: 0024

Community reports require an immutable area snapshot (area_path, ds_code, gs_code)
at the time of submission so area-scoped work queues (D01) can safely aggregate
and route reports to local staff without depending solely on subsequent member moves.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add area snapshot columns to npm.community_report
    op.execute(
        """
        ALTER TABLE npm.community_report
        ADD COLUMN IF NOT EXISTS area_path text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS ds_code text REFERENCES geo.ds_division(ds_code),
        ADD COLUMN IF NOT EXISTS gs_code text REFERENCES geo.gn_division(gn_code);
        """
    )

    # 2. Backfill existing reports using reporter's membership geography
    op.execute(
        """
        UPDATE npm.community_report cr
        SET gs_code = CASE WHEN cr.district_code IS NULL THEN g.gn_code ELSE NULL END,
            ds_code = CASE WHEN cr.district_code IS NULL THEN COALESCE(m.ds_code, g.ds_code) ELSE NULL END,
            district_code = COALESCE(cr.district_code, m.district_code, ds.district_code),
            area_path = CASE
                -- district_code existed in the legacy report at submission time;
                -- do not invent finer historical geography from the member's current address.
                WHEN cr.district_code IS NOT NULL THEN
                    ARRAY['platform',
                          'province:' || (SELECT province_code FROM geo.district WHERE district_code = cr.district_code),
                          'district:' || cr.district_code]
                WHEN g.gn_code IS NOT NULL THEN
                    ARRAY['platform', 'province:' || p.province_code, 'district:' || d.district_code, 'ds:' || ds.ds_code, 'gn:' || g.gn_code]
                WHEN ds.ds_code IS NOT NULL THEN
                    ARRAY['platform', 'province:' || p.province_code, 'district:' || d.district_code, 'ds:' || ds.ds_code]
                WHEN d.district_code IS NOT NULL THEN
                    ARRAY['platform', 'province:' || p.province_code, 'district:' || d.district_code]
                ELSE
                    ARRAY['platform']
            END
        FROM npm.member m
        LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
        LEFT JOIN geo.ds_division ds ON ds.ds_code = COALESCE(m.ds_code, g.ds_code)
        LEFT JOIN geo.district d ON d.district_code = COALESCE(m.district_code, ds.district_code)
        LEFT JOIN geo.province p ON p.province_code = d.province_code
        WHERE cr.member_id = m.id;
        """
    )

    # 3. Ensure any report without a resolved path defaults safely to platform
    op.execute(
        """
        UPDATE npm.community_report
        SET area_path = ARRAY['platform']
        WHERE area_path = '{}' OR area_path IS NULL;
        """
    )

    # 4. Create GIN index for area-path scoping and operational queue indexes
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS community_report_area_path_idx
        ON npm.community_report USING gin (area_path);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS community_report_queue_idx
        ON npm.community_report (status, created_at DESC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS community_report_ds_idx
        ON npm.community_report (ds_code);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS community_report_gs_idx
        ON npm.community_report (gs_code);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS npm.community_report_gs_idx")
    op.execute("DROP INDEX IF EXISTS npm.community_report_ds_idx")
    op.execute("DROP INDEX IF EXISTS npm.community_report_queue_idx")
    op.execute("DROP INDEX IF EXISTS npm.community_report_area_path_idx")
    op.execute("ALTER TABLE npm.community_report DROP COLUMN IF EXISTS gs_code")
    op.execute("ALTER TABLE npm.community_report DROP COLUMN IF EXISTS ds_code")
    op.execute("ALTER TABLE npm.community_report DROP COLUMN IF EXISTS area_path")
