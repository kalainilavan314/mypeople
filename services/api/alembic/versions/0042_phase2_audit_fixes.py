"""Phase 2 audit fixes against MP-FEA-002 (13 November 2026).

Revision ID: 0042
Revises: 0041

Only adds tables, columns, constraints and policies; no existing data is changed.

- Field visits sit behind row-level security like household (0021) and assistance (0038) data
  (MP-FEA-002 §8), and a visit's place is optional: a GN or a DS division chosen by hand, or none (S05).
- W03: the GN collector records the affected area before forwarding a case.
- D12: a moderator may publish an edited (redacted) version of an idea or added information, and
  the author may appeal a moderation decision once, decided by a different moderator.
- Promise Tracker: a missed 10-working-day update is escalated once; a Tamil status reason.
- My Household (M06, M07, M10): the household's area, children as guardian-managed minimum records
  without an account (OD-31 recommendation), each adult's own age band and occupation category,
  and the caseworker consent the household gives or withdraws (OD-30 recommendation).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0042"
down_revision: str | None = "0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FIELD_TABLES = ("visit", "visit_count")
AGE_BANDS = "('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus')"
OCCUPATIONS = (
    "('farming', 'fishing', 'daily_labour', 'trade', 'government', 'private_sector', 'self_employed', 'student', "
    "'homemaker', 'retired', 'unemployed', 'other')"
)
CONSENT_ACTIONS = (
    "('create_household', 'update_name', 'invite_adult', 'accept_invitation', 'decline_invitation', "
    "'revoke_invitation', 'leave_household', 'remove_member', 'add_dependent', 'remove_dependent', "
    "'dissolve_household', 'staff_view', 'update_member', 'caseworker_consent_given', 'caseworker_consent_withdrawn')"
)


def upgrade() -> None:
    # --- Field visits: row-level security and an optional place ------------------------------------------
    for table in FIELD_TABLES:
        op.execute(f"ALTER TABLE field.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE field.{table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY firewall ON field.{table}
            USING (current_setting('field.firewall', true) = 'open')
            WITH CHECK (current_setting('field.firewall', true) = 'open')
            """
        )
    op.execute("ALTER TABLE field.visit ALTER COLUMN gn_code DROP NOT NULL")
    op.execute("ALTER TABLE field.visit ADD COLUMN ds_code text REFERENCES geo.ds_division (ds_code)")
    op.execute("ALTER TABLE field.visit ADD CONSTRAINT visit_one_place CHECK (gn_code IS NULL OR ds_code IS NULL)")

    # --- Community issues: the affected area (W03) -----------------------------------------------------------
    op.execute(
        "ALTER TABLE community.issue ADD COLUMN affected_area text "
        "CHECK (affected_area IS NULL OR char_length(affected_area) BETWEEN 3 AND 300)"
    )

    # --- D12: redacted versions and one appeal per moderation decision ------------------------------------
    op.execute(
        "ALTER TABLE community.idea ADD COLUMN published_title text "
        "CHECK (published_title IS NULL OR char_length(published_title) BETWEEN 5 AND 80)"
    )
    op.execute(
        "ALTER TABLE community.idea ADD COLUMN published_benefit text "
        "CHECK (published_benefit IS NULL OR char_length(published_benefit) BETWEEN 10 AND 1000)"
    )
    op.execute(
        "ALTER TABLE community.issue_addition ADD COLUMN published_body text "
        "CHECK (published_body IS NULL OR char_length(published_body) BETWEEN 5 AND 2000)"
    )
    op.execute(
        """
        CREATE TABLE community.moderation_appeal (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            item_kind          text NOT NULL CHECK (item_kind IN ('idea', 'addition')),
            item_id            uuid NOT NULL,
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            body               text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
            original_moderator uuid NOT NULL REFERENCES npm.member (id),
            area_path          text[] NOT NULL,
            state              text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'upheld', 'changed')),
            reason             text CHECK (reason IS NULL OR char_length(reason) BETWEEN 3 AND 500),
            decided_by         uuid REFERENCES npm.member (id),
            decided_at         timestamptz,
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            -- One appeal per decision, and never decided by the moderator who made it.
            CONSTRAINT moderation_appeal_once UNIQUE (item_kind, item_id),
            CONSTRAINT moderation_appeal_other_person CHECK (decided_by IS NULL OR decided_by <> original_moderator),
            CONSTRAINT moderation_appeal_decided CHECK ((state = 'open') = (decided_at IS NULL)),
            CONSTRAINT moderation_appeal_reason CHECK (state = 'open' OR reason IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX moderation_appeal_open ON community.moderation_appeal (created_at) WHERE state = 'open'")
    op.execute("CREATE INDEX moderation_appeal_area ON community.moderation_appeal USING gin (area_path)")

    # --- Promise Tracker ------------------------------------------------------------------------------------
    op.execute("ALTER TABLE community.promise ADD COLUMN update_missed_alerted_at timestamptz")
    op.execute(
        "ALTER TABLE community.promise ADD COLUMN status_reason_ta text "
        "CHECK (status_reason_ta IS NULL OR char_length(status_reason_ta) BETWEEN 3 AND 1500)"
    )

    # --- My Household ---------------------------------------------------------------------------------------
    op.execute("ALTER TABLE household.household ADD COLUMN area_key text")
    op.execute("ALTER TABLE household.household ADD COLUMN area_path text[]")
    op.execute("ALTER TABLE household.household ADD COLUMN caseworker_consent_at timestamptz")
    op.execute("ALTER TABLE household.household ADD COLUMN caseworker_consent_by uuid REFERENCES npm.member (id)")
    op.execute(
        "ALTER TABLE household.household ADD CONSTRAINT household_caseworker_consent "
        "CHECK ((caseworker_consent_at IS NULL) = (caseworker_consent_by IS NULL))"
    )

    op.execute("ALTER TABLE household.household_member DROP CONSTRAINT household_member_role_check")
    op.execute(
        "ALTER TABLE household.household_member ADD CONSTRAINT household_member_role_check "
        "CHECK (role IN ('head', 'adult', 'dependent'))"
    )
    op.execute("ALTER TABLE household.household_member DROP CONSTRAINT household_member_relationship_check")
    op.execute(
        "ALTER TABLE household.household_member ADD CONSTRAINT household_member_relationship_check "
        "CHECK (relationship IN ('head', 'spouse', 'parent', 'sibling', 'child', 'grandchild', 'other'))"
    )
    op.execute("ALTER TABLE household.household_member ADD COLUMN birth_year integer CHECK (birth_year BETWEEN 1900 AND 2100)")
    op.execute("ALTER TABLE household.household_member ADD COLUMN guardian_member_id uuid REFERENCES npm.member (id)")
    op.execute(f"ALTER TABLE household.household_member ADD COLUMN age_band text CHECK (age_band IN {AGE_BANDS})")
    op.execute(
        f"ALTER TABLE household.household_member ADD COLUMN occupation_category text CHECK (occupation_category IN {OCCUPATIONS})"
    )
    # OD-31 recommendation: a child is a guardian-managed minimum record, never an account: first
    # name, relationship, birth year and guardian only. Adults describe themselves (OD-30).
    op.execute(
        """
        ALTER TABLE household.household_member ADD CONSTRAINT household_member_child_minimum CHECK (
            (role = 'dependent') = (member_id IS NULL)
            AND (role <> 'dependent' OR (birth_year IS NOT NULL AND guardian_member_id IS NOT NULL
                                         AND age_band IS NULL AND occupation_category IS NULL))
            AND (role = 'dependent' OR (birth_year IS NULL AND guardian_member_id IS NULL))
        )
        """
    )
    op.execute("ALTER TABLE household.consent_log DROP CONSTRAINT consent_log_action_check")
    op.execute(f"ALTER TABLE household.consent_log ADD CONSTRAINT consent_log_action_check CHECK (action IN {CONSENT_ACTIONS})")
    # Any confirmed adult of the household (a parent or guardian) may add and correct a child's record.
    op.execute(
        """
        CREATE POLICY household_member_dependent_insert ON household.household_member FOR INSERT WITH CHECK (
            role = 'dependent' AND household.member_is_in_household(household_id, household.current_member_id())
        );
        CREATE POLICY household_member_dependent_update ON household.household_member FOR UPDATE USING (
            role = 'dependent' AND household.member_is_in_household(household_id, household.current_member_id())
        );
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY household_member_dependent_update ON household.household_member")
    op.execute("DROP POLICY household_member_dependent_insert ON household.household_member")
    op.execute("ALTER TABLE household.consent_log DROP CONSTRAINT consent_log_action_check")
    op.execute(
        "ALTER TABLE household.consent_log ADD CONSTRAINT consent_log_action_check CHECK (action IN ('create_household', "
        "'update_name', 'invite_adult', 'accept_invitation', 'decline_invitation', 'revoke_invitation', 'leave_household', "
        "'remove_member', 'add_dependent', 'remove_dependent', 'dissolve_household', 'staff_view'))"
    )
    op.execute("ALTER TABLE household.household_member DROP CONSTRAINT household_member_child_minimum")
    for column in ("occupation_category", "age_band", "guardian_member_id", "birth_year"):
        op.execute(f"ALTER TABLE household.household_member DROP COLUMN {column}")
    op.execute("ALTER TABLE household.household_member DROP CONSTRAINT household_member_relationship_check")
    op.execute(
        "ALTER TABLE household.household_member ADD CONSTRAINT household_member_relationship_check "
        "CHECK (relationship IN ('head', 'spouse', 'parent', 'sibling', 'other'))"
    )
    op.execute("ALTER TABLE household.household_member DROP CONSTRAINT household_member_role_check")
    op.execute("ALTER TABLE household.household_member ADD CONSTRAINT household_member_role_check CHECK (role IN ('head', 'adult'))")
    op.execute("ALTER TABLE household.household DROP CONSTRAINT household_caseworker_consent")
    for column in ("caseworker_consent_by", "caseworker_consent_at", "area_path", "area_key"):
        op.execute(f"ALTER TABLE household.household DROP COLUMN {column}")
    op.execute("ALTER TABLE community.promise DROP COLUMN status_reason_ta")
    op.execute("ALTER TABLE community.promise DROP COLUMN update_missed_alerted_at")
    op.execute("DROP TABLE community.moderation_appeal")
    op.execute("ALTER TABLE community.issue_addition DROP COLUMN published_body")
    op.execute("ALTER TABLE community.idea DROP COLUMN published_benefit")
    op.execute("ALTER TABLE community.idea DROP COLUMN published_title")
    op.execute("ALTER TABLE community.issue DROP COLUMN affected_area")
    op.execute("ALTER TABLE field.visit DROP CONSTRAINT visit_one_place")
    op.execute("ALTER TABLE field.visit DROP COLUMN ds_code")
    op.execute("ALTER TABLE field.visit ALTER COLUMN gn_code SET NOT NULL")
    for table in FIELD_TABLES:
        op.execute(f"DROP POLICY firewall ON field.{table}")
        op.execute(f"ALTER TABLE field.{table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE field.{table} DISABLE ROW LEVEL SECURITY")
