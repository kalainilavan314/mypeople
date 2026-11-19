"""Disaster and emergency support, relief logistics and the blood donor network (BRD v1.1 FR-DIS-001 to 008,
FR-BLD-001 to 008, BR-138 to 141, OS-14, OS-15; screens M35 to M38, S16, D26, D27).

Revision ID: 0048
Revises: 0045

- disaster.alert and alert_revision (ENT-54): official warnings relayed by staff with disaster.relay,
  each with its official source, the source's own link, issue time and end time, and the District, DS
  or GN divisions it targets. Every relay, check against the source and withdrawal is kept as a
  revision. Alerts are kept for 2 years.
- disaster.shelter: shelter information from an authorised source with the time it reported.
- disaster.relief_volunteer: members who offered to help in relief work, with their consent.
- relief.supply and relief.distribution (ENT-54): stock received and relief handed out. Behind the
  same kind of row-level firewall as Community Support (FR-DIS-005, BR-102): a recipient is only an
  AS- case or a group at a site, never a name, a membership or anything about support.
- donors.partner and donors.requester: hospitals and the blood transfusion service, and the accounts
  they authorised to raise requests (PRM-55, OD-39).
- donors.donor (ENT-55), donors.request and donors.response (ENT-56): explicit opt-in, requests from
  partners only, and contact passed on only after the donor accepts. Donor data is deleted at once on
  withdrawal; requests are kept 12 months [ASSUMPTION] OD-39. Health data, so the whole schema is
  behind a row-level firewall that only the blood donor module opens.

Additive only: nothing existing changes.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0048"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

HAZARDS = "('flood', 'cyclone', 'heavy_rain', 'strong_wind', 'landslide', 'lightning', 'tsunami', 'drought', 'other')"
SEVERITIES = "('advisory', 'watch', 'warning')"
ALERT_SOURCES = "('dmc', 'meteorology')"
SHELTER_SOURCES = "('dmc', 'district_secretariat', 'divisional_secretariat')"
RELIEF_TASKS = "ARRAY['distribution', 'cooking', 'transport', 'shelter_support', 'cleaning', 'loading', 'first_aid']"
ITEMS = (
    "('rice', 'dry_rations', 'drinking_water', 'cooked_meals', 'clothing', 'mats_blankets', 'hygiene_kits',"
    " 'tarpaulins', 'baby_food', 'kitchen_sets')"
)
BLOOD_GROUPS = "('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')"
PHONE = "'^\\+?[0-9 ]{9,15}$'"


def _firewall(schema: str, tables: Sequence[str]) -> None:
    """Every row is invisible unless the module opened its firewall for this transaction."""
    for table in tables:
        op.execute(f"ALTER TABLE {schema}.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {schema}.{table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY firewall ON {schema}.{table}
            USING (current_setting('{schema}.firewall', true) = 'open')
            WITH CHECK (current_setting('{schema}.firewall', true) = 'open')
            """
        )


def _append_only(schema: str, tables: Sequence[str]) -> None:
    op.execute(
        f"""
        CREATE FUNCTION {schema}.refuse_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION '{schema} history is append-only';
        END $$
        """
    )
    for table in tables:
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {schema}.{table}
            FOR EACH ROW EXECUTE FUNCTION {schema}.refuse_history_change()
            """
        )


def _disaster() -> None:
    op.execute("CREATE SCHEMA disaster")
    op.execute("CREATE SEQUENCE disaster.alert_number_seq")
    op.execute(
        f"""
        CREATE TABLE disaster.alert (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            alert_ref         text NOT NULL UNIQUE DEFAULT ('AL-' || lpad(nextval('disaster.alert_number_seq')::text, 5, '0')),
            source_key        text NOT NULL CHECK (source_key IN {ALERT_SOURCES}),
            source_url        text NOT NULL CHECK (char_length(source_url) BETWEEN 12 AND 500 AND source_url LIKE 'https://%'),
            source_issued_at  timestamptz NOT NULL,
            source_ends_at    timestamptz NOT NULL,
            hazard            text NOT NULL CHECK (hazard IN {HAZARDS}),
            severity          text NOT NULL CHECK (severity IN {SEVERITIES}),
            title_en          text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 160),
            title_ta          text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 220),
            body_en           text NOT NULL CHECK (char_length(body_en) BETWEEN 10 AND 3000),
            body_ta           text NOT NULL CHECK (char_length(body_ta) BETWEEN 10 AND 4500),
            -- The District, DS and GN divisions the alert is for (FR-DIS-002) ...
            target_keys       text[] NOT NULL CHECK (cardinality(target_keys) BETWEEN 1 AND 50),
            -- ... and every area above them, so staff of a district see the alerts for its divisions.
            scope_keys        text[] NOT NULL,
            state             text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'withdrawn')),
            withdrawn_reason  text CHECK (withdrawn_reason IS NULL OR char_length(withdrawn_reason) BETWEEN 5 AND 500),
            relayed_by        uuid NOT NULL REFERENCES npm.member (id),
            relayed_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            -- When someone last checked the alert against its source (FR-DIS-008: flagged after 6 hours).
            refreshed_by      uuid NOT NULL REFERENCES npm.member (id),
            refreshed_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            stale_alerted_at  timestamptz,
            recipients        integer NOT NULL DEFAULT 0 CHECK (recipients >= 0),
            CONSTRAINT ends_after_issue CHECK (source_ends_at > source_issued_at),
            CONSTRAINT withdrawn_has_reason CHECK ((state = 'withdrawn') = (withdrawn_reason IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX alert_targets ON disaster.alert USING gin (target_keys)")
    op.execute("CREATE INDEX alert_scope ON disaster.alert USING gin (scope_keys)")
    op.execute("CREATE INDEX alert_current ON disaster.alert (source_ends_at) WHERE state = 'active'")
    op.execute(
        f"""
        CREATE TABLE disaster.alert_revision (
            id                bigserial PRIMARY KEY,
            alert_id          uuid NOT NULL REFERENCES disaster.alert (id) ON DELETE CASCADE,
            kind              text NOT NULL CHECK (kind IN ('relayed', 'refreshed', 'withdrawn')),
            source_url        text NOT NULL,
            source_issued_at  timestamptz NOT NULL,
            source_ends_at    timestamptz NOT NULL,
            severity          text NOT NULL CHECK (severity IN {SEVERITIES}),
            title_en          text NOT NULL,
            title_ta          text NOT NULL,
            body_en           text NOT NULL,
            body_ta           text NOT NULL,
            note              text,
            changed_by        uuid NOT NULL REFERENCES npm.member (id),
            changed_at        timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX alert_revision_alert ON disaster.alert_revision (alert_id, id)")
    op.execute(
        f"""
        CREATE TABLE disaster.shelter (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name_en             text NOT NULL CHECK (char_length(name_en) BETWEEN 3 AND 160),
            name_ta             text NOT NULL CHECK (char_length(name_ta) BETWEEN 3 AND 220),
            place_en            text NOT NULL CHECK (char_length(place_en) BETWEEN 3 AND 300),
            place_ta            text NOT NULL CHECK (char_length(place_ta) BETWEEN 3 AND 450),
            area_key            text NOT NULL,
            area_path           text[] NOT NULL,
            status              text NOT NULL CHECK (status IN ('open', 'full', 'closed')),
            capacity            integer CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 100000),
            source_key          text NOT NULL CHECK (source_key IN {SHELTER_SOURCES}),
            source_url          text CHECK (source_url IS NULL OR (char_length(source_url) BETWEEN 12 AND 500
                                                                   AND source_url LIKE 'https://%')),
            source_reported_at  timestamptz NOT NULL,
            recorded_by         uuid NOT NULL REFERENCES npm.member (id),
            updated_by          uuid NOT NULL REFERENCES npm.member (id),
            created_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at          timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX shelter_area ON disaster.shelter USING gin (area_path)")
    op.execute(
        f"""
        CREATE TABLE disaster.relief_volunteer (
            member_id        uuid PRIMARY KEY REFERENCES npm.member (id),
            tasks            text[] NOT NULL CHECK (cardinality(tasks) BETWEEN 1 AND 7 AND tasks <@ {RELIEF_TASKS}::text[]),
            available_until  date NOT NULL,
            -- The member's home area when they offered; coordinators see the offers in their scope.
            area_key         text NOT NULL,
            area_path        text[] NOT NULL,
            consent_version  text NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 40),
            consented_at     timestamptz NOT NULL,
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX relief_volunteer_area ON disaster.relief_volunteer USING gin (area_path)")


def _relief() -> None:
    op.execute("CREATE SCHEMA relief")
    op.execute(
        f"""
        CREATE TABLE relief.supply (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            -- The store: the District or DS division whose relief stock this is.
            store_key    text NOT NULL,
            store_path   text[] NOT NULL,
            item         text NOT NULL CHECK (item IN {ITEMS}),
            quantity     integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
            supplier     text NOT NULL CHECK (char_length(supplier) BETWEEN 2 AND 200),
            received_on  date NOT NULL,
            -- The alert this followed, if any. Not a foreign key: alerts are deleted after 2 years and
            -- relief records never change.
            alert_id     uuid,
            recorded_by  uuid NOT NULL REFERENCES npm.member (id),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX supply_store ON relief.supply (store_key, item)")
    op.execute("CREATE SEQUENCE relief.distribution_number_seq")
    op.execute(
        f"""
        CREATE TABLE relief.distribution (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            distribution_ref  text NOT NULL UNIQUE
                              DEFAULT ('RD-' || lpad(nextval('relief.distribution_number_seq')::text, 6, '0')),
            store_key         text NOT NULL,
            store_path        text[] NOT NULL,
            area_key          text NOT NULL,
            area_path         text[] NOT NULL,
            item              text NOT NULL CHECK (item IN {ITEMS}),
            quantity          integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
            recipient_kind    text NOT NULL CHECK (recipient_kind IN ('case', 'group')),
            -- A recipient is a Community Support case (under its firewall) or a group at a site: never a
            -- name, a membership or anything about political support (FR-DIS-005, BR-102).
            case_id           uuid REFERENCES assistance.case (id),
            group_site        text CHECK (group_site IS NULL OR char_length(group_site) BETWEEN 3 AND 200),
            households        integer CHECK (households IS NULL OR households BETWEEN 1 AND 100000),
            evidence          text NOT NULL CHECK (char_length(evidence) BETWEEN 3 AND 500),
            delivered_on      date NOT NULL,
            alert_id          uuid,  -- as in relief.supply
            recorded_by       uuid NOT NULL REFERENCES npm.member (id),
            created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT case_recipient CHECK ((recipient_kind = 'case') = (case_id IS NOT NULL)),
            CONSTRAINT group_recipient CHECK (
                (recipient_kind = 'group') = (group_site IS NOT NULL AND households IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX distribution_store ON relief.distribution (store_key, item)")
    op.execute("CREATE INDEX distribution_area ON relief.distribution USING gin (area_path)")
    _append_only("relief", ("supply", "distribution"))
    _firewall("relief", ("supply", "distribution"))


def _donors() -> None:
    op.execute("CREATE SCHEMA donors")
    op.execute(
        """
        CREATE TABLE donors.partner (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name           text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 200),
            kind           text NOT NULL CHECK (kind IN ('hospital', 'blood_bank')),
            district_key   text NOT NULL,
            -- The signed partner agreement on file (DEP-18, OD-39).
            agreement_ref  text NOT NULL CHECK (char_length(agreement_ref) BETWEEN 3 AND 120),
            active         boolean NOT NULL DEFAULT true,
            created_by     uuid NOT NULL REFERENCES npm.member (id),
            created_at     timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE donors.requester (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            partner_id  uuid NOT NULL REFERENCES donors.partner (id),
            member_id   uuid NOT NULL REFERENCES npm.member (id),
            granted_by  uuid NOT NULL REFERENCES npm.member (id),
            granted_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            revoked_by  uuid REFERENCES npm.member (id),
            revoked_at  timestamptz
        )
        """
    )
    # One partner organisation per account at a time.
    op.execute("CREATE UNIQUE INDEX requester_one_partner ON donors.requester (member_id) WHERE revoked_at IS NULL")
    op.execute(
        f"""
        CREATE TABLE donors.donor (
            member_id        uuid PRIMARY KEY REFERENCES npm.member (id),
            blood_group      text NOT NULL CHECK (blood_group IN {BLOOD_GROUPS}),
            -- A broad service area: a District or DS division, never a GN or an address.
            area_key         text NOT NULL CHECK (area_key ~ '^(district|ds):'),
            area_path        text[] NOT NULL,
            contact_name     text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 120),
            contact_phone    text NOT NULL CHECK (contact_phone ~ {PHONE}),
            contact_methods  text[] NOT NULL CHECK (cardinality(contact_methods) BETWEEN 1 AND 3
                                 AND contact_methods <@ ARRAY['call', 'sms', 'whatsapp']::text[]),
            available        boolean NOT NULL DEFAULT true,
            paused_until     date,
            consent_version  text NOT NULL CHECK (char_length(consent_version) BETWEEN 1 AND 40),
            consented_at     timestamptz NOT NULL,
            last_notified_at timestamptz,
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at       timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX donor_match ON donors.donor (blood_group) WHERE available")
    op.execute("CREATE SEQUENCE donors.request_number_seq")
    op.execute(
        f"""
        CREATE TABLE donors.request (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_ref      text NOT NULL UNIQUE DEFAULT ('BR-' || lpad(nextval('donors.request_number_seq')::text, 6, '0')),
            partner_id       uuid NOT NULL REFERENCES donors.partner (id),
            raised_by        uuid NOT NULL REFERENCES npm.member (id),
            blood_group      text NOT NULL CHECK (blood_group IN {BLOOD_GROUPS}),
            area_key         text NOT NULL CHECK (area_key ~ '^(district|ds):'),
            area_path        text[] NOT NULL,
            units            integer NOT NULL CHECK (units BETWEEN 1 AND 20),
            urgency          text NOT NULL CHECK (urgency IN ('routine', 'urgent', 'critical')),
            needed_by        timestamptz NOT NULL,
            state            text NOT NULL CHECK (state IN ('awaiting_approval', 'open', 'closed', 'refused')),
            over_limit       boolean NOT NULL DEFAULT false,
            decided_by       uuid REFERENCES npm.member (id),
            decided_at       timestamptz,
            decision_reason  text CHECK (decision_reason IS NULL OR char_length(decision_reason) BETWEEN 5 AND 500),
            outcome          text CHECK (outcome IN ('fulfilled', 'partly_fulfilled', 'not_needed', 'unfulfilled')),
            -- Counts only: the partner never sees who was told or who declined (FR-BLD-004).
            notified         integer NOT NULL DEFAULT 0 CHECK (notified >= 0),
            accepted         integer NOT NULL DEFAULT 0 CHECK (accepted >= 0),
            declined         integer NOT NULL DEFAULT 0 CHECK (declined >= 0),
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            closed_at        timestamptz,
            CONSTRAINT closed_has_outcome CHECK ((state = 'closed') = (outcome IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX request_partner ON donors.request (partner_id, created_at DESC)")
    op.execute(
        """
        CREATE TABLE donors.response (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id      uuid NOT NULL REFERENCES donors.request (id) ON DELETE CASCADE,
            member_id       uuid NOT NULL REFERENCES npm.member (id),
            state           text NOT NULL DEFAULT 'notified' CHECK (state IN ('notified', 'accepted', 'declined')),
            -- Copied from the donor's record only when they accept and consent (FR-BLD-005).
            shared_name     text,
            shared_phone    text,
            shared_methods  text[],
            answered_at     timestamptz,
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (request_id, member_id),
            CONSTRAINT shared_only_on_accept CHECK ((state = 'accepted') = (shared_phone IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX response_member ON donors.response (member_id, created_at DESC)")
    _firewall("donors", ("partner", "requester", "donor", "request", "response"))


def upgrade() -> None:
    _disaster()
    _relief()
    _donors()


def downgrade() -> None:
    op.execute("DROP SCHEMA donors CASCADE")
    op.execute("DROP SCHEMA relief CASCADE")
    op.execute("DROP SCHEMA disaster CASCADE")
