"""Community Support / சமூக உதவி: confidential assistance cases (BRD v1.1 FR-AST-001 to 013, BR-102 to 108;
screens M11 to M14, S11, S12, D13, D14).

Revision ID: 0038
Revises: 0037

A schema of its own, apart from membership, finance, events and campaign data, which no assistance
query ever joins (FR-AST-009, NFR-PRV-07). Help never depends on membership: an applicant may be a
member who asked in the app or anyone who used the public form, the hotline or a partner.

- assistance.programme, criteria_version and partner (D14): published eligibility criteria in
  versions, and the organisations cases may be referred to.
- assistance.applicant and assistance.case: the person (name, phone, area only) and a case whose
  AS- reference is random and says nothing about the person, place or category (FR-AST-005).
- case_note, decision, delivery, referral and appeal: the case record. Decisions cite a criteria
  version (FR-AST-008); every partner referral carries its own consent (FR-AST-004); one appeal
  per decision, decided by someone else (FR-AST-011). Notes, decisions and deliveries are
  append-only.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = (
    "('food', 'low_income', 'unemployment', 'education', 'disability_access', 'elderly_care', 'housing',"
    " 'emergency_needs', 'vocational_training', 'livelihood')"
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA assistance")
    op.execute(
        f"""
        CREATE TABLE assistance.programme (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name_en         text NOT NULL CHECK (char_length(name_en) BETWEEN 3 AND 160),
            name_ta         text NOT NULL CHECK (char_length(name_ta) BETWEEN 3 AND 220),
            description_en  text NOT NULL CHECK (char_length(description_en) BETWEEN 10 AND 3000),
            description_ta  text NOT NULL CHECK (char_length(description_ta) BETWEEN 10 AND 4500),
            categories      text[] NOT NULL CHECK (cardinality(categories) >= 1 AND categories <@ ARRAY{CATEGORIES.replace("(", "[").replace(")", "]")}::text[]),
            active          boolean NOT NULL DEFAULT true,
            created_by      uuid NOT NULL REFERENCES npm.member (id),
            created_at      timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.criteria_version (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            programme_id  uuid NOT NULL REFERENCES assistance.programme (id),
            version       integer NOT NULL,
            criteria_en   text NOT NULL CHECK (char_length(criteria_en) BETWEEN 10 AND 6000),
            criteria_ta   text NOT NULL CHECK (char_length(criteria_ta) BETWEEN 10 AND 9000),
            published_by  uuid NOT NULL REFERENCES npm.member (id),
            published_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (programme_id, version)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.partner (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name        text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 200),
            kind        text NOT NULL CHECK (kind IN ('ngo', 'public_service', 'hospital', 'other')),
            contact     text NOT NULL CHECK (char_length(contact) BETWEEN 3 AND 300),
            active      boolean NOT NULL DEFAULT true,
            created_by  uuid NOT NULL REFERENCES npm.member (id),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.applicant (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            -- Set only when the person asked through their own app account; never used to read
            -- anything about their membership (FR-AST-009).
            member_id   uuid REFERENCES npm.member (id),
            full_name   text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
            phone       text CHECK (phone IS NULL OR phone ~ '^\\+?[0-9 ]{9,15}$'),
            household   text CHECK (household IS NULL OR char_length(household) BETWEEN 2 AND 120),
            area_key    text NOT NULL,
            area_path   text[] NOT NULL,
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX applicant_phone ON assistance.applicant (phone) WHERE phone IS NOT NULL")
    op.execute("CREATE INDEX applicant_member ON assistance.applicant (member_id) WHERE member_id IS NOT NULL")
    op.execute(
        f"""
        CREATE TABLE assistance.case (
            id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_ref               text NOT NULL UNIQUE CHECK (case_ref ~ '^AS-[A-Z2-7]{{8}}$'),
            applicant_id           uuid NOT NULL REFERENCES assistance.applicant (id),
            category               text NOT NULL CHECK (category IN {CATEGORIES}),
            emergency              boolean NOT NULL DEFAULT false,
            summary                text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 3000),
            channel                text NOT NULL CHECK (channel IN ('app', 'web_form', 'hotline', 'partner')),
            partner_id             uuid REFERENCES assistance.partner (id),
            consent_at             timestamptz NOT NULL,
            state                  text NOT NULL DEFAULT 'screening'
                                   CHECK (state IN ('screening', 'assessment', 'decided', 'closed', 'withdrawn')),
            caseworker_id          uuid REFERENCES npm.member (id),
            linked_case_id         uuid REFERENCES assistance.case (id),
            area_key               text NOT NULL,
            area_path              text[] NOT NULL,
            source_ip              text,
            created_by             uuid REFERENCES npm.member (id),
            created_at             timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at             timestamptz NOT NULL DEFAULT clock_timestamp(),
            closed_at              timestamptz,
            CONSTRAINT partner_channel CHECK ((channel = 'partner') = (partner_id IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX case_area ON assistance.case USING gin (area_path)")
    op.execute("CREATE INDEX case_applicant ON assistance.case (applicant_id, created_at DESC)")
    op.execute("CREATE INDEX case_open ON assistance.case (state, created_at) WHERE state IN ('screening', 'assessment')")
    op.execute(
        """
        CREATE TABLE assistance.case_note (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id     uuid NOT NULL REFERENCES assistance.case (id),
            author_id   uuid NOT NULL REFERENCES npm.member (id),
            body        text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 3000),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.decision (
            id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id              uuid NOT NULL REFERENCES assistance.case (id),
            outcome              text NOT NULL CHECK (outcome IN ('approved', 'partly_approved', 'not_eligible', 'referred')),
            criteria_version_id  uuid NOT NULL REFERENCES assistance.criteria_version (id),
            reason_en            text NOT NULL CHECK (char_length(reason_en) BETWEEN 10 AND 2000),
            reason_ta            text NOT NULL CHECK (char_length(reason_ta) BETWEEN 10 AND 3000),
            decided_by           uuid NOT NULL REFERENCES npm.member (id),
            -- Set on a decision that answers an appeal: the earlier decision it replaces.
            replaces_id          uuid REFERENCES assistance.decision (id),
            decided_at           timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.delivery (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id       uuid NOT NULL REFERENCES assistance.case (id),
            kind          text NOT NULL CHECK (char_length(kind) BETWEEN 3 AND 120),
            amount        text NOT NULL CHECK (char_length(amount) BETWEEN 1 AND 120),
            delivered_on  date NOT NULL,
            provider      text NOT NULL CHECK (char_length(provider) BETWEEN 2 AND 200),
            evidence      text NOT NULL CHECK (char_length(evidence) BETWEEN 3 AND 500),
            recorded_by   uuid NOT NULL REFERENCES npm.member (id),
            created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.referral (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id      uuid NOT NULL REFERENCES assistance.case (id),
            partner_id   uuid NOT NULL REFERENCES assistance.partner (id),
            -- Consent for this partner, recorded before anything is shared (FR-AST-004).
            consent_at   timestamptz NOT NULL,
            state        text NOT NULL DEFAULT 'sent' CHECK (state IN ('sent', 'accepted', 'completed', 'declined')),
            outcome      text CHECK (outcome IS NULL OR char_length(outcome) BETWEEN 3 AND 1000),
            created_by   uuid NOT NULL REFERENCES npm.member (id),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE assistance.appeal (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            decision_id  uuid NOT NULL UNIQUE REFERENCES assistance.decision (id),
            case_id      uuid NOT NULL REFERENCES assistance.case (id),
            kind         text NOT NULL CHECK (kind IN ('appeal', 'complaint')),
            body         text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
            state        text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'upheld', 'changed')),
            due_at       timestamptz NOT NULL,
            decided_by   uuid REFERENCES npm.member (id),
            reason       text CHECK (reason IS NULL OR char_length(reason) BETWEEN 10 AND 2000),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            decided_at   timestamptz
        )
        """
    )
    op.execute(
        """
        CREATE FUNCTION assistance.refuse_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'assistance history is append-only';
        END $$
        """
    )
    for table in ("case_note", "decision", "delivery"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON assistance.{table}
            FOR EACH ROW EXECUTE FUNCTION assistance.refuse_history_change()
            """
        )

    # The firewall (FR-AST-009, BR-102): every row is invisible unless the assistance module opened
    # it for this transaction, so no other module, report or ad-hoc join can read assistance data.
    for table in (
        "programme", "criteria_version", "partner", "applicant", "case", "case_note", "decision", "delivery",
        "referral", "appeal",
    ):
        op.execute(f"ALTER TABLE assistance.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE assistance.{table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY firewall ON assistance.{table}
            USING (current_setting('assistance.firewall', true) = 'open')
            WITH CHECK (current_setting('assistance.firewall', true) = 'open')
            """
        )


def downgrade() -> None:
    op.execute("DROP SCHEMA assistance CASCADE")
