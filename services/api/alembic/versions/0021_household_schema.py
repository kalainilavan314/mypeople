"""My Household schema with Row-Level Security (BRD v1.1 FR-HH-001 to 010, BR-098 to 101, PRM-33)

Revision ID: 0021
Revises: 0020
Create Date: 2026-11-03

- household.household: Voluntary household container
- household.household_member: Members of household (head, adult)
- household.invitation: Adult invitations with explicit consent lifecycle
- household.consent_log: Audit trail of voluntary consents and actions
- RLS enabled and forced across all household schema tables
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA household")

    # 1. Household table
    op.execute(
        """
        CREATE TABLE household.household (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            created_by    uuid NOT NULL REFERENCES npm.member (id),
            name          text CHECK (name IS NULL OR (char_length(name) BETWEEN 1 AND 100)),
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
            dissolved_at  timestamptz
        )
        """
    )
    op.execute("CREATE INDEX household_created_by ON household.household (created_by)")

    # 2. Household member table
    op.execute(
        """
        CREATE TABLE household.household_member (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            household_id  uuid NOT NULL REFERENCES household.household (id) ON DELETE CASCADE,
            member_id     uuid REFERENCES npm.member (id),
            role          text NOT NULL CHECK (role IN ('head', 'adult')),
            display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
            relationship  text NOT NULL CHECK (relationship IN ('head', 'spouse', 'parent', 'sibling', 'other')),
            status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
            joined_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            removed_at    timestamptz,
            CONSTRAINT household_member_role_member_id CHECK ((role = 'dependent') OR (member_id IS NOT NULL)),
            CONSTRAINT household_member_head_rel CHECK ((role <> 'head') OR (relationship = 'head'))
        )
        """
    )
    op.execute("CREATE INDEX household_member_household ON household.household_member (household_id)")
    op.execute("CREATE INDEX household_member_member ON household.household_member (member_id) WHERE member_id IS NOT NULL")
    op.execute(
        "CREATE UNIQUE INDEX household_member_unique_active_member ON household.household_member (member_id) "
        "WHERE member_id IS NOT NULL AND status = 'active'"
    )
    op.execute(
        "CREATE UNIQUE INDEX household_single_active_head ON household.household_member (household_id) "
        "WHERE role = 'head' AND status = 'active'"
    )

    # 3. Household invitation table
    op.execute(
        """
        CREATE TABLE household.invitation (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            household_id       uuid NOT NULL REFERENCES household.household (id) ON DELETE CASCADE,
            inviter_member_id  uuid NOT NULL REFERENCES npm.member (id),
            invitee_member_id  uuid NOT NULL REFERENCES npm.member (id),
            relationship       text NOT NULL CHECK (relationship IN ('spouse', 'parent', 'sibling', 'other')),
            status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            expires_at         timestamptz NOT NULL,
            responded_at       timestamptz,
            CONSTRAINT invitation_no_self_invite CHECK (inviter_member_id <> invitee_member_id)
        )
        """
    )
    op.execute("CREATE INDEX invitation_household ON household.invitation (household_id)")
    op.execute("CREATE INDEX invitation_inviter ON household.invitation (inviter_member_id)")
    op.execute("CREATE INDEX invitation_invitee_status ON household.invitation (invitee_member_id, status)")
    op.execute(
        "CREATE UNIQUE INDEX invitation_unique_pending ON household.invitation (household_id, invitee_member_id) "
        "WHERE status = 'pending'"
    )

    # 4. Consent log table
    op.execute(
        """
        CREATE TABLE household.consent_log (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            household_id  uuid NOT NULL REFERENCES household.household (id) ON DELETE CASCADE,
            member_id     uuid REFERENCES npm.member (id),
            actor_id      uuid NOT NULL REFERENCES npm.member (id),
            action        text NOT NULL CHECK (action IN ('create_household', 'update_name', 'invite_adult', 'accept_invitation', 'decline_invitation', 'revoke_invitation', 'leave_household', 'remove_member', 'add_dependent', 'remove_dependent', 'dissolve_household', 'staff_view')),
            details       jsonb,
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX consent_log_household ON household.consent_log (household_id, created_at)")
    op.execute("CREATE INDEX consent_log_member ON household.consent_log (member_id, created_at)")
    op.execute("CREATE INDEX consent_log_actor ON household.consent_log (actor_id, created_at)")

    # 5. Helper functions for RLS
    op.execute(
        """
        CREATE OR REPLACE FUNCTION household.current_member_id() RETURNS uuid STABLE LANGUAGE sql AS $$
            SELECT NULLIF(current_setting('app.current_member_id', true), '')::uuid;
        $$;
        CREATE OR REPLACE FUNCTION household.is_staff_view() RETURNS boolean STABLE LANGUAGE sql AS $$
            SELECT COALESCE(current_setting('app.household_view_for_case', true), '') = 'on';
        $$;
        CREATE OR REPLACE FUNCTION household.staff_target_member_id() RETURNS uuid STABLE LANGUAGE sql AS $$
            SELECT NULLIF(current_setting('app.household_target_member_id', true), '')::uuid;
        $$;
        CREATE OR REPLACE FUNCTION household.staff_household_id() RETURNS uuid STABLE LANGUAGE sql AS $$
            SELECT NULLIF(current_setting('app.household_scope_id', true), '')::uuid;
        $$;
        CREATE OR REPLACE FUNCTION household.bypass_rls() RETURNS boolean STABLE LANGUAGE sql AS $$
            SELECT COALESCE(current_setting('app.bypass_rls', true), '') = 'on';
        $$;
        CREATE OR REPLACE FUNCTION household.member_is_in_household(h_id uuid, m_id uuid)
        RETURNS boolean STABLE SECURITY DEFINER LANGUAGE sql AS $$
            SELECT EXISTS (
                SELECT 1 FROM household.household_member
                WHERE household_id = h_id
                  AND member_id = m_id
                  AND status = 'active'
            );
        $$;
        CREATE OR REPLACE FUNCTION household.member_is_head(h_id uuid, m_id uuid)
        RETURNS boolean STABLE SECURITY DEFINER LANGUAGE sql AS $$
            SELECT EXISTS (
                SELECT 1 FROM household.household_member
                WHERE household_id = h_id
                  AND member_id = m_id
                  AND role = 'head'
                  AND status = 'active'
            );
        $$;
        """
    )

    # 6. Enable and force RLS on all tables
    for tbl in ("household", "household_member", "invitation", "consent_log"):
        op.execute(f"ALTER TABLE household.{tbl} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE household.{tbl} FORCE ROW LEVEL SECURITY")

    # 7. Policies for household.household
    op.execute(
        """
        CREATE POLICY household_select ON household.household FOR SELECT USING (
            household.bypass_rls()
            OR (household.is_staff_view() AND id = household.staff_household_id())
            OR created_by = household.current_member_id()
            OR household.member_is_in_household(id, household.current_member_id())
        );

        CREATE POLICY household_insert ON household.household FOR INSERT WITH CHECK (
            household.bypass_rls()
            OR created_by = household.current_member_id()
        );

        CREATE POLICY household_update ON household.household FOR UPDATE USING (
            household.bypass_rls()
            OR created_by = household.current_member_id()
            OR household.member_is_head(id, household.current_member_id())
        );

        CREATE POLICY household_delete ON household.household FOR DELETE USING (
            household.bypass_rls()
            OR created_by = household.current_member_id()
            OR household.member_is_head(id, household.current_member_id())
        );
        """
    )

    # 8. Policies for household.household_member
    op.execute(
        """
        CREATE POLICY household_member_select ON household.household_member FOR SELECT USING (
            household.bypass_rls()
            OR (
                household.is_staff_view()
                AND (
                    household_id = household.staff_household_id()
                    OR member_id = household.staff_target_member_id()
                )
            )
            OR member_id = household.current_member_id()
            OR household.member_is_in_household(household_id, household.current_member_id())
        );

        CREATE POLICY household_member_insert ON household.household_member FOR INSERT WITH CHECK (
            household.bypass_rls()
            OR (member_id = household.current_member_id() AND role = 'head')
            OR household.member_is_head(household_id, household.current_member_id())
        );

        CREATE POLICY household_member_update ON household.household_member FOR UPDATE USING (
            household.bypass_rls()
            OR member_id = household.current_member_id()
            OR household.member_is_head(household_id, household.current_member_id())
        );

        CREATE POLICY household_member_delete ON household.household_member FOR DELETE USING (
            household.bypass_rls()
            OR member_id = household.current_member_id()
            OR household.member_is_head(household_id, household.current_member_id())
        );
        """
    )

    # 9. Policies for household.invitation
    op.execute(
        """
        CREATE POLICY invitation_select ON household.invitation FOR SELECT USING (
            household.bypass_rls()
            OR inviter_member_id = household.current_member_id()
            OR invitee_member_id = household.current_member_id()
            OR household.member_is_in_household(household_id, household.current_member_id())
        );

        CREATE POLICY invitation_insert ON household.invitation FOR INSERT WITH CHECK (
            household.bypass_rls()
            OR (
                inviter_member_id = household.current_member_id()
                AND household.member_is_head(household_id, household.current_member_id())
            )
        );

        CREATE POLICY invitation_update ON household.invitation FOR UPDATE USING (
            household.bypass_rls()
            OR inviter_member_id = household.current_member_id()
            OR invitee_member_id = household.current_member_id()
        );

        CREATE POLICY invitation_delete ON household.invitation FOR DELETE USING (
            household.bypass_rls()
            OR inviter_member_id = household.current_member_id()
            OR household.member_is_head(household_id, household.current_member_id())
        );
        """
    )

    # 10. Policies for household.consent_log
    op.execute(
        """
        CREATE POLICY consent_log_select ON household.consent_log FOR SELECT USING (
            household.bypass_rls()
            OR member_id = household.current_member_id()
            OR actor_id = household.current_member_id()
            OR household.member_is_in_household(household_id, household.current_member_id())
        );

        CREATE POLICY consent_log_insert ON household.consent_log FOR INSERT WITH CHECK (
            household.bypass_rls()
            OR actor_id = household.current_member_id()
            OR household.is_staff_view()
        );
        """
    )


def downgrade() -> None:
    op.execute("DROP SCHEMA household CASCADE")
