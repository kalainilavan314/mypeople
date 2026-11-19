"""Participatory budgeting / பங்கேற்பு வரவுசெலவு (BRD v1.1 FR-PBG-001 to 010, BR-121 to 124; screens M24 to M27, D19).

Revision ID: 0046
Revises: 0045

Members vote on which approved local projects receive a set budget. It is a party or community
consultation on a lawfully controlled fund, never a public election or a government budget (BR-123).

- engagement.pb_cycle: the budget, fund source, dates and eligibility rules, published before voting
  opens; a trigger refuses any change to them once voting is scheduled (BR-121).
- engagement.pb_project: a development proposal approved for planning, with its estimated cost and a
  recorded financial and legal review; a CHECK keeps a project off the ballot until both reviews are
  recorded (FR-PBG-002).
- ballot.participation and ballot.ballot, in a schema of their own behind a row-level firewall that
  only the budgeting module opens (FR-PBG-010, NFR-PRV-07). A participation row proves a member took
  part (one per member per cycle, by its primary key, FR-PBG-004); a ballot row holds the choices and
  nothing about the voter: no member column, no timestamp, a random id (FR-PBG-005). Ballots are
  hash-chained per cycle (ballot.chain holds the head) so the count can be reproduced (FR-PBG-006).
  The receipt code is never stored: each table keeps a different one-way hash of it, which cannot be
  matched without the code itself.
- engagement.pb_certification and pb_result: two different people certify the same recount; then
  the totals, and only the totals, are published (FR-PBG-006, 007).
- finance.pb_allocation and finance.pb_expenditure: the finance module has no general ledger table
  yet (ENT-66 is not built), so allocations and spending are kept in the finance schema in tables of
  their own, append-only, with no member or voter column (FR-PBG-008, BR-155, BR-158).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0046"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = (
    "('draft', 'proposal_intake', 'review', 'voting_open', 'voting_closed', 'results_certified', 'allocated',"
    " 'implemented', 'cancelled')"
)


def upgrade() -> None:
    op.execute("CREATE SEQUENCE engagement.pb_cycle_number_seq")
    op.execute(
        f"""
        CREATE TABLE engagement.pb_cycle (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            cycle_ref          text NOT NULL UNIQUE DEFAULT ('PB-' || lpad(nextval('engagement.pb_cycle_number_seq')::text, 4, '0')),
            title_en           text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 160),
            title_ta           text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 220),
            description_en     text NOT NULL CHECK (char_length(description_en) BETWEEN 10 AND 3000),
            description_ta     text NOT NULL CHECK (char_length(description_ta) BETWEEN 10 AND 4500),
            -- OD-25: which lawful fund pays; the label shown to members says so.
            fund_kind          text NOT NULL CHECK (fund_kind IN ('party_fund', 'community_fund')),
            fund_source_en     text NOT NULL CHECK (char_length(fund_source_en) BETWEEN 3 AND 300),
            fund_source_ta     text NOT NULL CHECK (char_length(fund_source_ta) BETWEEN 3 AND 450),
            budget             numeric(14, 2) NOT NULL CHECK (budget > 0),
            currency           text NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
            area_key           text NOT NULL,
            area_path          text[] NOT NULL,
            eligibility_en     text NOT NULL CHECK (char_length(eligibility_en) BETWEEN 10 AND 3000),
            eligibility_ta     text NOT NULL CHECK (char_length(eligibility_ta) BETWEEN 10 AND 4500),
            min_age            integer NOT NULL DEFAULT 18 CHECK (min_age BETWEEN 18 AND 120),
            max_choices        integer NOT NULL CHECK (max_choices BETWEEN 1 AND 10),
            voting_opens_at    timestamptz NOT NULL,
            voting_closes_at   timestamptz NOT NULL,
            status             text NOT NULL DEFAULT 'draft' CHECK (status IN {STATUSES}),
            status_reason      text CHECK (status_reason IS NULL OR char_length(status_reason) BETWEEN 10 AND 1000),
            rules_published_at timestamptz,
            -- KPI-33: eligible members when voting closed, so turnout can be reported as a share.
            eligible_count     integer CHECK (eligible_count IS NULL OR eligible_count >= 0),
            created_by         uuid NOT NULL REFERENCES npm.member (id),
            created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT voting_window CHECK (voting_closes_at > voting_opens_at),
            CONSTRAINT published_before_voting CHECK (
                status IN ('draft', 'cancelled') OR (rules_published_at IS NOT NULL AND rules_published_at < voting_opens_at)
            )
        )
        """
    )
    op.execute("CREATE INDEX pb_cycle_area ON engagement.pb_cycle USING gin (area_path)")
    op.execute("CREATE INDEX pb_cycle_status ON engagement.pb_cycle (status, voting_opens_at)")
    op.execute(
        """
        CREATE FUNCTION engagement.pb_cycle_rules_locked() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            -- BR-121: once voting is scheduled the published rules never change.
            IF OLD.status NOT IN ('draft', 'proposal_intake', 'review') AND (
                NEW.budget, NEW.fund_kind, NEW.fund_source_en, NEW.fund_source_ta, NEW.eligibility_en, NEW.eligibility_ta,
                NEW.min_age, NEW.max_choices, NEW.voting_opens_at, NEW.voting_closes_at, NEW.area_key, NEW.rules_published_at
            ) IS DISTINCT FROM (
                OLD.budget, OLD.fund_kind, OLD.fund_source_en, OLD.fund_source_ta, OLD.eligibility_en, OLD.eligibility_ta,
                OLD.min_age, OLD.max_choices, OLD.voting_opens_at, OLD.voting_closes_at, OLD.area_key, OLD.rules_published_at
            ) THEN
                RAISE EXCEPTION 'budgeting rules are locked once voting is scheduled';
            END IF;
            RETURN NEW;
        END $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER pb_cycle_rules_locked BEFORE UPDATE ON engagement.pb_cycle
        FOR EACH ROW EXECUTE FUNCTION engagement.pb_cycle_rules_locked()
        """
    )
    op.execute(
        """
        CREATE TABLE engagement.pb_project (
            id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            cycle_id                  uuid NOT NULL REFERENCES engagement.pb_cycle (id),
            proposal_id               uuid NOT NULL REFERENCES community.proposal (id),
            title_en                  text NOT NULL CHECK (char_length(title_en) BETWEEN 5 AND 160),
            title_ta                  text NOT NULL CHECK (char_length(title_ta) BETWEEN 5 AND 220),
            summary_en                text NOT NULL CHECK (char_length(summary_en) BETWEEN 10 AND 2000),
            summary_ta                text NOT NULL CHECK (char_length(summary_ta) BETWEEN 10 AND 3000),
            estimated_cost            numeric(14, 2) NOT NULL CHECK (estimated_cost > 0),
            financial_review_ref      text CHECK (financial_review_ref IS NULL OR char_length(financial_review_ref) BETWEEN 3 AND 200),
            financial_review_en       text CHECK (financial_review_en IS NULL OR char_length(financial_review_en) BETWEEN 10 AND 2000),
            financial_review_ta       text CHECK (financial_review_ta IS NULL OR char_length(financial_review_ta) BETWEEN 10 AND 3000),
            financial_reviewed_by     uuid REFERENCES npm.member (id),
            financial_reviewed_at     timestamptz,
            legal_review_ref          text CHECK (legal_review_ref IS NULL OR char_length(legal_review_ref) BETWEEN 3 AND 200),
            legal_review_en           text CHECK (legal_review_en IS NULL OR char_length(legal_review_en) BETWEEN 10 AND 2000),
            legal_review_ta           text CHECK (legal_review_ta IS NULL OR char_length(legal_review_ta) BETWEEN 10 AND 3000),
            legal_reviewed_by         uuid REFERENCES npm.member (id),
            legal_reviewed_at         timestamptz,
            on_ballot                 boolean NOT NULL DEFAULT false,
            completed_on              date,
            completion_evidence       text CHECK (completion_evidence IS NULL OR char_length(completion_evidence) BETWEEN 3 AND 500),
            completion_en             text CHECK (completion_en IS NULL OR char_length(completion_en) BETWEEN 10 AND 2000),
            completion_ta             text CHECK (completion_ta IS NULL OR char_length(completion_ta) BETWEEN 10 AND 3000),
            completed_by              uuid REFERENCES npm.member (id),
            created_by                uuid NOT NULL REFERENCES npm.member (id),
            created_at                timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at                timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (cycle_id, proposal_id),
            -- FR-PBG-002: a project without both recorded reviews can never be on the ballot.
            CONSTRAINT reviewed_before_ballot CHECK (
                NOT on_ballot OR (financial_reviewed_at IS NOT NULL AND legal_reviewed_at IS NOT NULL)
            ),
            CONSTRAINT completion_has_evidence CHECK (
                completed_on IS NULL OR (completion_evidence IS NOT NULL AND completed_by IS NOT NULL)
            )
        )
        """
    )
    op.execute("CREATE INDEX pb_project_cycle ON engagement.pb_project (cycle_id)")
    op.execute(
        """
        CREATE TABLE engagement.pb_certification (
            cycle_id      uuid NOT NULL REFERENCES engagement.pb_cycle (id),
            certified_by  uuid NOT NULL REFERENCES npm.member (id),
            ballot_count  integer NOT NULL CHECK (ballot_count >= 0),
            chain_head    text NOT NULL CHECK (chain_head ~ '^[0-9a-f]{64}$'),
            tally_hash    text NOT NULL CHECK (tally_hash ~ '^[0-9a-f]{64}$'),
            certified_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
            PRIMARY KEY (cycle_id, certified_by)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE engagement.pb_result (
            cycle_id    uuid NOT NULL REFERENCES engagement.pb_cycle (id),
            project_id  uuid NOT NULL REFERENCES engagement.pb_project (id),
            votes       integer NOT NULL CHECK (votes >= 0),
            rank        integer NOT NULL CHECK (rank >= 1),
            funded      boolean NOT NULL,
            PRIMARY KEY (cycle_id, project_id),
            UNIQUE (cycle_id, rank)
        )
        """
    )
    op.execute(
        """
        CREATE FUNCTION engagement.pb_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'budgeting certifications and results are append-only';
        END $$
        """
    )
    for table in ("pb_certification", "pb_result"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON engagement.{table}
            FOR EACH ROW EXECUTE FUNCTION engagement.pb_refuse_change()
            """
        )

    # The ballot box: apart from identity, behind its own firewall.
    op.execute("CREATE SCHEMA ballot")
    op.execute(
        """
        CREATE TABLE ballot.chain (
            cycle_id   uuid PRIMARY KEY REFERENCES engagement.pb_cycle (id),
            length     integer NOT NULL DEFAULT 0 CHECK (length >= 0),
            head_hash  text NOT NULL CHECK (head_hash ~ '^[0-9a-f]{64}$')
        )
        """
    )
    op.execute(
        """
        CREATE TABLE ballot.participation (
            cycle_id           uuid NOT NULL REFERENCES engagement.pb_cycle (id),
            member_id          uuid NOT NULL REFERENCES npm.member (id),
            -- The day only (ENT-46): nothing finer that could be matched with a ballot.
            participated_on    date NOT NULL,
            receipt_code_hash  text NOT NULL CHECK (receipt_code_hash ~ '^[0-9a-f]{64}$'),
            PRIMARY KEY (cycle_id, member_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE ballot.ballot (
            ballot_id     uuid PRIMARY KEY,
            cycle_id      uuid NOT NULL REFERENCES engagement.pb_cycle (id),
            position      integer NOT NULL CHECK (position >= 1),
            choices       uuid[] NOT NULL CHECK (cardinality(choices) BETWEEN 1 AND 10),
            receipt_hash  text NOT NULL CHECK (receipt_hash ~ '^[0-9a-f]{64}$'),
            prev_hash     text NOT NULL CHECK (prev_hash ~ '^[0-9a-f]{64}$'),
            ballot_hash   text NOT NULL UNIQUE CHECK (ballot_hash ~ '^[0-9a-f]{64}$'),
            UNIQUE (cycle_id, position),
            UNIQUE (cycle_id, receipt_hash)
        )
        """
    )
    op.execute(
        """
        CREATE FUNCTION ballot.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            -- Ballots and participation are insert-only. The budgeting module may delete rows only
            -- for retention (ENT-46, ENT-47) or to re-insert participation in member order when voting
            -- closes, so the order in which people voted is not kept beside the chain's order.
            IF TG_OP = 'DELETE' AND current_setting('ballot.maintenance', true) = 'on' THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'ballots and participation are append-only';
        END $$
        """
    )
    for table in ("participation", "ballot"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON ballot.{table}
            FOR EACH ROW EXECUTE FUNCTION ballot.refuse_change()
            """
        )
    # FR-PBG-010, NFR-PRV-07: every row is invisible unless the budgeting module opened the
    # firewall for its own transaction, so no report, export or ad-hoc join can read ballots or
    # participation, let alone combine them with membership or campaign data.
    for table in ("chain", "participation", "ballot"):
        op.execute(f"ALTER TABLE ballot.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE ballot.{table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY firewall ON ballot.{table}
            USING (current_setting('ballot.firewall', true) = 'open')
            WITH CHECK (current_setting('ballot.firewall', true) = 'open')
            """
        )

    # Allocations and spending (FR-PBG-008): finance entries of their own, append-only (BR-158).
    op.execute(
        """
        CREATE TABLE finance.pb_allocation (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            cycle_id     uuid NOT NULL REFERENCES engagement.pb_cycle (id),
            project_id   uuid NOT NULL UNIQUE REFERENCES engagement.pb_project (id),
            amount       numeric(14, 2) NOT NULL CHECK (amount > 0),
            currency     text NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
            fund_kind    text NOT NULL CHECK (fund_kind IN ('party_fund', 'community_fund')),
            fund_source  text NOT NULL CHECK (char_length(fund_source) BETWEEN 3 AND 300),
            recorded_by  uuid NOT NULL REFERENCES npm.member (id),
            recorded_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX pb_allocation_cycle ON finance.pb_allocation (cycle_id)")
    op.execute(
        """
        CREATE TABLE finance.pb_expenditure (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id      uuid NOT NULL REFERENCES engagement.pb_project (id),
            amount          numeric(14, 2) NOT NULL CHECK (amount > 0),
            spent_on        date NOT NULL,
            description_en  text NOT NULL CHECK (char_length(description_en) BETWEEN 5 AND 1000),
            description_ta  text NOT NULL CHECK (char_length(description_ta) BETWEEN 5 AND 1500),
            evidence_ref    text NOT NULL CHECK (char_length(evidence_ref) BETWEEN 3 AND 500),
            recorded_by     uuid NOT NULL REFERENCES npm.member (id),
            recorded_at     timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX pb_expenditure_project ON finance.pb_expenditure (project_id, spent_on)")
    op.execute(
        """
        CREATE FUNCTION finance.pb_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'budgeting allocations and spending are append-only';
        END $$
        """
    )
    for table in ("pb_allocation", "pb_expenditure"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON finance.{table}
            FOR EACH ROW EXECUTE FUNCTION finance.pb_refuse_change()
            """
        )


def downgrade() -> None:
    op.execute("DROP TABLE finance.pb_expenditure")
    op.execute("DROP TABLE finance.pb_allocation")
    op.execute("DROP FUNCTION finance.pb_refuse_change()")
    op.execute("DROP SCHEMA ballot CASCADE")
    op.execute("DROP TABLE engagement.pb_result")
    op.execute("DROP TABLE engagement.pb_certification")
    op.execute("DROP FUNCTION engagement.pb_refuse_change()")
    op.execute("DROP TABLE engagement.pb_project")
    op.execute("DROP TABLE engagement.pb_cycle")
    op.execute("DROP FUNCTION engagement.pb_cycle_rules_locked()")
    op.execute("DROP SEQUENCE engagement.pb_cycle_number_seq")
