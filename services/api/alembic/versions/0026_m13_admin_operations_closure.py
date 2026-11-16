"""Close M1.3 report routing and broadcast audience targeting gaps.

Revision ID: 0026
Revises: 0025

Community reports receive an immutable geography snapshot on every future
insert, including inserts made by the frozen Express service. Broadcast tier
filters refer only to effective staff authorization tiers; they never use the
deprecated member referral ranks.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION npm.set_community_report_area_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            resolved_province text;
            resolved_district text;
            resolved_ds text;
            resolved_gn text;
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF NEW.area_path IS DISTINCT FROM OLD.area_path
                   OR NEW.district_code IS DISTINCT FROM OLD.district_code
                   OR NEW.ds_code IS DISTINCT FROM OLD.ds_code
                   OR NEW.gs_code IS DISTINCT FROM OLD.gs_code THEN
                    RAISE EXCEPTION 'community_report_area_snapshot_is_immutable';
                END IF;
                RETURN NEW;
            END IF;

            IF NEW.gs_code IS NOT NULL THEN
                SELECT d.province_code, ds.district_code, g.ds_code, g.gn_code
                  INTO resolved_province, resolved_district, resolved_ds, resolved_gn
                  FROM geo.gn_division g
                  JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
                  JOIN geo.district d ON d.district_code = ds.district_code
                 WHERE g.gn_code = NEW.gs_code;
            ELSIF NEW.ds_code IS NOT NULL THEN
                SELECT d.province_code, ds.district_code, ds.ds_code
                  INTO resolved_province, resolved_district, resolved_ds
                  FROM geo.ds_division ds
                  JOIN geo.district d ON d.district_code = ds.district_code
                 WHERE ds.ds_code = NEW.ds_code;
            ELSIF NEW.district_code IS NOT NULL THEN
                SELECT d.province_code, d.district_code
                  INTO resolved_province, resolved_district
                  FROM geo.district d
                 WHERE d.district_code = NEW.district_code;
            ELSE
                SELECT d.province_code, d.district_code, ds.ds_code, g.gn_code
                  INTO resolved_province, resolved_district, resolved_ds, resolved_gn
                  FROM npm.member m
                  LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
                  LEFT JOIN geo.ds_division ds ON ds.ds_code = COALESCE(m.ds_code, g.ds_code)
                  LEFT JOIN geo.district d ON d.district_code = COALESCE(m.district_code, ds.district_code)
                 WHERE m.id = NEW.member_id;
            END IF;

            NEW.district_code := resolved_district;
            NEW.ds_code := resolved_ds;
            NEW.gs_code := resolved_gn;
            NEW.area_path := CASE
                WHEN resolved_gn IS NOT NULL THEN
                    ARRAY['platform', 'province:' || resolved_province, 'district:' || resolved_district,
                          'ds:' || resolved_ds, 'gn:' || resolved_gn]
                WHEN resolved_ds IS NOT NULL THEN
                    ARRAY['platform', 'province:' || resolved_province, 'district:' || resolved_district,
                          'ds:' || resolved_ds]
                WHEN resolved_district IS NOT NULL THEN
                    ARRAY['platform', 'province:' || resolved_province, 'district:' || resolved_district]
                ELSE ARRAY['platform']
            END;
            RETURN NEW;
        END;
        $$
        """
    )

    # Revision 0025 has already reconstructed legacy records. Only repair an
    # unexpectedly empty path; never reinterpret a populated historical snapshot.
    op.execute(
        """
        UPDATE npm.community_report cr
           SET area_path = CASE
                WHEN cr.district_code IS NOT NULL THEN
                    ARRAY['platform',
                          'province:' || (SELECT province_code FROM geo.district WHERE district_code = cr.district_code),
                          'district:' || cr.district_code]
                WHEN g.gn_code IS NOT NULL THEN
                    ARRAY['platform', 'province:' || md.province_code, 'district:' || mds.district_code,
                          'ds:' || mds.ds_code, 'gn:' || g.gn_code]
                WHEN mds.ds_code IS NOT NULL THEN
                    ARRAY['platform', 'province:' || md.province_code, 'district:' || mds.district_code,
                          'ds:' || mds.ds_code]
                WHEN md.district_code IS NOT NULL THEN
                    ARRAY['platform', 'province:' || md.province_code, 'district:' || md.district_code]
                ELSE ARRAY['platform']
               END,
               ds_code = CASE WHEN cr.district_code IS NULL THEN mds.ds_code ELSE NULL END,
               gs_code = CASE WHEN cr.district_code IS NULL THEN g.gn_code ELSE NULL END,
               district_code = COALESCE(cr.district_code, md.district_code)
          FROM npm.member m
          LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
          LEFT JOIN geo.ds_division mds ON mds.ds_code = COALESCE(m.ds_code, g.ds_code)
          LEFT JOIN geo.district md ON md.district_code = COALESCE(m.district_code, mds.district_code)
         WHERE cr.member_id = m.id
           AND (cr.area_path IS NULL OR cardinality(cr.area_path) = 0)
        """
    )
    op.execute("ALTER TABLE npm.community_report ALTER COLUMN area_path DROP DEFAULT")
    op.execute(
        """
        CREATE TRIGGER community_report_area_snapshot
        BEFORE INSERT OR UPDATE OF area_path, district_code, ds_code, gs_code ON npm.community_report
        FOR EACH ROW EXECUTE FUNCTION npm.set_community_report_area_snapshot()
        """
    )

    op.execute(
        """
        ALTER TABLE notifications.broadcast
        ADD COLUMN audience_tiers text[],
        ADD CONSTRAINT broadcast_audience_tiers_valid CHECK (
            audience_tiers IS NULL OR (
                cardinality(audience_tiers) > 0
                AND audience_tiers <@ ARRAY['1','2A','2B','3A','3B','4','5']::text[]
            )
        )
        """
    )
    op.execute(
        """
        CREATE INDEX staff_assignment_active_tier_area
        ON access.staff_assignment (tier, area_level, area_code, member_id)
        WHERE state = 'active'
        """
    )


def downgrade() -> None:
    raise RuntimeError("M1.3 routing and audience evidence require a reviewed preservation plan")
