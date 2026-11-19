"""Participatory budgeting (M24 to M27, D19; FR-PBG-001 to 010, BR-121 to 124)."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.modules.engagement.budgeting import rules
from app.modules.engagement.budgeting import service as budgeting

START = datetime.now(UTC)


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def manager(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["pb.manage"], granted_by=super_admin)
    return person


@pytest.fixture
def certifier(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["pb.certify"], granted_by=super_admin)
    return person


@pytest.fixture
def treasurer(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["finance.approve"], granted_by=super_admin)
    return person


@pytest.fixture
def voter(member_in, area, db_session):
    def make(born: date | None = date(1990, 5, 1), **options):
        person = member_in(area, **({"verified": True, "active": True} | options))
        db_session.execute(text("UPDATE npm.member SET dob = :dob WHERE id = :id"), {"dob": born, "id": person.id})
        return person

    return make


@pytest.fixture
def clock(monkeypatch):
    """Move the budgeting service's clock to START + the given time."""

    def at(delta: timedelta) -> None:
        monkeypatch.setattr(budgeting, "_now", lambda: START + delta)

    return at


def approved_proposal(db_session, author, area, title, stage="approved_for_planning"):
    return str(db_session.scalar(
        text(
            """INSERT INTO community.proposal (author_id, client_reference, title, category, area_key, area_path, problem,
                                               solution, benefit, cost_estimate, stage, published_at)
               VALUES (:a, :ref, :title, 'drinking_water', :key, :path, :problem, :solution, :benefit, 900000, :stage, now())
               RETURNING id"""
        ),
        {"a": author.id, "ref": uuid.uuid4(), "title": title, "key": f"gn:{area.gn}",
         "path": ["platform", f"province:{area.province}", f"district:{area.district}", f"ds:{area.ds}", f"gn:{area.gn}"],
         "problem": "Families walk two kilometres for drinking water every day.",
         "solution": "Build a covered community well with a hand pump near the school.",
         "benefit": "About 120 families get safe water nearby.", "stage": stage},
    ))


def cycle_body(area, **overrides):
    return {
        "titleEn": "Village water and roads 2027", "titleTa": "கிராம நீர் மற்றும் வீதிகள் 2027",
        "descriptionEn": "Choose which approved local projects the community fund pays for.",
        "descriptionTa": "சமூக நிதி எந்த அங்கீகரிக்கப்பட்ட உள்ளூர்த் திட்டங்களுக்குச் செலவிடப்படும் என்பதைத் தெரிவு செய்யுங்கள்.",
        "fundKind": "community_fund", "fundSourceEn": "TMK community projects fund",
        "fundSourceTa": "தாயக மக்கள் கழக சமூகத் திட்ட நிதி", "budget": "1500000.00",
        "eligibilityEn": "Verified, active members aged 18 or over living in the district.",
        "eligibilityTa": "மாவட்டத்தில் வசிக்கும், 18 வயதுக்கு மேற்பட்ட, சரிபார்க்கப்பட்ட செயலில் உள்ள உறுப்பினர்கள்.",
        "maxChoices": 2,
        "votingOpensAt": (START + timedelta(hours=1)).isoformat(),
        "votingClosesAt": (START + timedelta(hours=2)).isoformat(),
        "area": {"level": "district", "code": area.district},
        **overrides,
    }


def project_body(proposal_id, cost="600000.00", title="Community well at the school"):
    return {"proposalId": proposal_id, "titleEn": title, "titleTa": "பாடசாலை அருகே சமூகக் கிணறு",
            "summaryEn": "A covered well with a hand pump for 120 families.",
            "summaryTa": "120 குடும்பங்களுக்குக் கைப்பம்பியுடன் மூடிய கிணறு.", "estimatedCost": cost}


def review(kind):
    return {"kind": kind, "reference": f"{kind.upper()}-2027/04", "noteEn": f"The {kind} review found no objection.",
            "noteTa": "மீளாய்வில் எந்த ஆட்சேபனையும் இல்லை."}


def ready_cycle(client, auth, manager, area, db_session, projects=2, costs=("600000.00", "700000.00", "900000.00")):
    """A published cycle with reviewed projects on the ballot and voting scheduled."""
    cycle = client.post("/v1/pb/manage/cycles", json=cycle_body(area), headers=auth(manager))
    assert cycle.status_code == 201, cycle.json()
    cycle_id = cycle.json()["id"]
    assert client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "proposal_intake"},
                       headers=auth(manager)).status_code == 200
    ids = []
    for n in range(projects):
        proposal = approved_proposal(db_session, manager, area, f"Water project number {n + 1}")
        added = client.post(f"/v1/pb/manage/cycles/{cycle_id}/projects", json=project_body(proposal, costs[n],
                            f"Water project number {n + 1}"), headers=auth(manager)).json()
        project_id = next(p["id"] for p in added["projects"] if p["proposalId"] == proposal)
        for kind in ("financial", "legal"):
            client.post(f"/v1/pb/manage/projects/{project_id}/reviews", json=review(kind), headers=auth(manager))
        placed = client.post(f"/v1/pb/manage/projects/{project_id}/ballot", json={"onBallot": True}, headers=auth(manager))
        assert placed.status_code == 200, placed.json()
        ids.append(project_id)
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "review"}, headers=auth(manager))
    opened = client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "voting_open"}, headers=auth(manager))
    assert opened.status_code == 200 and opened.json()["status"] == "voting_open", opened.json()
    return cycle_id, ids


def problems(response):
    return response.json()["detail"]["problems"]


def test_rules_are_published_before_voting_and_never_change_during_it(client, auth, manager, area, voter, db_session):
    member = voter()
    draft = client.post("/v1/pb/manage/cycles", json=cycle_body(area), headers=auth(manager)).json()
    hidden = client.get(f"/v1/pb/cycles/{draft['id']}", headers=auth(member))
    late = client.post("/v1/pb/manage/cycles", json=cycle_body(area, votingOpensAt=(START + timedelta(hours=3)).isoformat()),
                       headers=auth(manager))
    published = client.post(f"/v1/pb/manage/cycles/{draft['id']}/move", json={"to": "proposal_intake"},
                            headers=auth(manager)).json()
    shown = client.get(f"/v1/pb/cycles/{draft['id']}", headers=auth(member)).json()
    listed = [c["id"] for c in client.get("/v1/pb/cycles", headers=auth(member)).json()]

    assert hidden.status_code == 404 and draft["status"] == "draft"
    assert problems(late) == ["closes_before_opens"]
    assert published["rules"]["rulesPublishedAt"] is not None and draft["id"] in listed
    assert shown["phase"] == "upcoming" and shown["fundKind"] == "community_fund" and shown["budget"] == "1500000.00"
    assert shown["rules"]["eligibilityTa"].startswith("மாவட்டத்தில்") and shown["inMyArea"] is True
    # Not enough projects to open voting, and a cancel needs a reason.
    too_few = client.post(f"/v1/pb/manage/cycles/{draft['id']}/move", json={"to": "review"}, headers=auth(manager))
    no_reason = client.post(f"/v1/pb/manage/cycles/{draft['id']}/move", json={"to": "cancelled"}, headers=auth(manager))
    assert problems(too_few) == ["no_projects"] and problems(no_reason) == ["reason_required"]

    cycle_id, _ = ready_cycle(client, auth, manager, area, db_session)
    locked = client.put(f"/v1/pb/manage/cycles/{cycle_id}", json=cycle_body(area, budget="9000000.00"), headers=auth(manager))
    assert problems(locked) == ["rules_locked"]
    # BR-121 in the database too: the published rules cannot be changed behind the API.
    with pytest.raises(DBAPIError, match="locked once voting is scheduled"), db_session.begin_nested():
        db_session.execute(text("UPDATE engagement.pb_cycle SET budget = 1 WHERE id = :id"), {"id": cycle_id})


def test_only_reviewed_proposals_approved_for_planning_reach_the_ballot(client, auth, manager, area, voter, db_session):
    member = voter()
    cycle_id = client.post("/v1/pb/manage/cycles", json=cycle_body(area), headers=auth(manager)).json()["id"]
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "proposal_intake"}, headers=auth(manager))
    approved = approved_proposal(db_session, manager, area, "Community well at the school")
    in_review = approved_proposal(db_session, manager, area, "Road resurfacing project", stage="review")

    candidates = [c["id"] for c in client.get(f"/v1/pb/manage/cycles/{cycle_id}/candidates", headers=auth(manager)).json()]
    refused = client.post(f"/v1/pb/manage/cycles/{cycle_id}/projects", json=project_body(in_review), headers=auth(manager))
    added = client.post(f"/v1/pb/manage/cycles/{cycle_id}/projects", json=project_body(approved), headers=auth(manager))
    project_id = added.json()["projects"][0]["id"]
    twice = client.post(f"/v1/pb/manage/cycles/{cycle_id}/projects", json=project_body(approved), headers=auth(manager))
    client.post(f"/v1/pb/manage/projects/{project_id}/reviews", json=review("financial"), headers=auth(manager))
    no_legal = client.post(f"/v1/pb/manage/projects/{project_id}/ballot", json={"onBallot": True}, headers=auth(manager))
    before = client.get(f"/v1/pb/cycles/{cycle_id}", headers=auth(member)).json()

    assert approved in candidates and in_review not in candidates
    assert problems(refused) == ["proposal_not_approved_for_planning"]
    assert added.status_code == 201 and problems(twice) == ["proposal_not_approved_for_planning"]
    assert problems(no_legal) == ["legal_review_required"]
    assert before["projects"] == []  # members see only projects on the ballot
    # FR-PBG-002 in the database: a project without a legal review cannot be put on the ballot.
    with pytest.raises(DBAPIError, match="reviewed_before_ballot"), db_session.begin_nested():
        db_session.execute(text("UPDATE engagement.pb_project SET on_ballot = true WHERE id = :id"), {"id": project_id})

    client.post(f"/v1/pb/manage/projects/{project_id}/reviews", json=review("legal"), headers=auth(manager))
    placed = client.post(f"/v1/pb/manage/projects/{project_id}/ballot", json={"onBallot": True}, headers=auth(manager))
    detail = client.get(f"/v1/pb/projects/{project_id}", headers=auth(member)).json()
    assert placed.status_code == 200
    assert detail["legalReview"]["reference"] == "LEGAL-2027/04" and detail["estimatedCost"] == "600000.00"
    assert detail["problem"].startswith("Families walk") and detail["votes"] is None

    # A new estimated cost needs a new financial review: it is cleared and the project leaves the ballot.
    changed = client.put(f"/v1/pb/manage/projects/{project_id}", json=project_body(None, "650000.00"),
                         headers=auth(manager)).json()
    project = changed["projects"][0]
    assert project["financialReview"] is None and project["onBallot"] is False and project["legalReview"] is not None


def test_eligibility_is_checked_at_ballot_time(client, auth, manager, area, voter, member_in, db_session, clock):
    cycle_id, (first, second) = ready_cycle(client, auth, manager, area, db_session)
    adult, child, no_birth_date = voter(), voter(born=date.today() - timedelta(days=365 * 16)), voter(born=None)
    unverified = voter(verified=False, active=False)
    elsewhere = voter()
    db_session.execute(text("UPDATE npm.member SET gs_code = NULL, ds_code = NULL, district_code = NULL WHERE id = :id"),
                       {"id": elsewhere.id})
    ballot = {"choices": [first]}

    early = client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json=ballot, headers=auth(adult))
    clock(timedelta(minutes=90))
    refusals = {
        name: problems(client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json=ballot, headers=auth(person)))
        for name, person in (("child", child), ("no_birth_date", no_birth_date), ("unverified", unverified),
                             ("elsewhere", elsewhere))
    }
    too_many = client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": [first, second, str(uuid.uuid4())]},
                           headers=auth(adult))
    view = client.get(f"/v1/pb/cycles/{cycle_id}", headers=auth(child)).json()

    assert problems(early) == ["voting_not_open"]
    assert refusals == {"child": ["under_voting_age"], "no_birth_date": ["age_not_recorded"],
                        "unverified": ["identity_not_verified"], "elsewhere": ["outside_cycle_area"]}
    assert problems(too_many) == ["too_many_choices", "not_on_ballot"]
    assert view["canVote"] is False and view["ineligibleReason"] == "under_voting_age"


def test_one_private_ballot_per_member_with_a_receipt_that_reveals_no_choice(client, auth, manager, area, voter, db_session,
                                                                              clock):
    cycle_id, (first, second) = ready_cycle(client, auth, manager, area, db_session)
    member = voter()
    clock(timedelta(minutes=90))

    cast = client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": [second, first]}, headers=auth(member))
    again = client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": [first]}, headers=auth(member))
    view = client.get(f"/v1/pb/cycles/{cycle_id}", headers=auth(member)).json()
    code = cast.json()["receiptCode"]
    checked = client.post(f"/v1/pb/cycles/{cycle_id}/receipt-check", json={"receiptCode": code.lower().replace("-", " ")},
                          headers=auth(member)).json()
    unknown = client.post(f"/v1/pb/cycles/{cycle_id}/receipt-check", json={"receiptCode": rules.new_receipt_code()},
                          headers=auth(member)).json()

    assert cast.status_code == 201 and len(code) == 19 and cast.json()["participatedOn"]
    assert problems(again) == ["already_voted"]
    assert view["canVote"] is False and view["participatedOn"] is not None
    assert checked == {"counted": True, "certified": False} and unknown == {"counted": False, "certified": False}
    assert set(checked) == {"counted", "certified"}  # never the choice

    # FR-PBG-005: no column links a ballot to a member; the two rows share no value.
    columns = set(db_session.scalars(text(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'ballot' AND table_name = 'ballot'")))
    assert columns == {"ballot_id", "cycle_id", "position", "choices", "receipt_hash", "prev_hash", "ballot_hash"}
    db_session.execute(text("SELECT set_config('ballot.firewall', 'open', true)"))
    took_part = db_session.execute(text("SELECT * FROM ballot.participation WHERE cycle_id = :c"), {"c": cycle_id}).mappings().one()
    stored = db_session.execute(text("SELECT * FROM ballot.ballot WHERE cycle_id = :c"), {"c": cycle_id}).mappings().one()
    assert {str(v) for k, v in took_part.items() if k != "cycle_id"}.isdisjoint({str(v) for k, v in stored.items()})
    assert code.replace("-", "") not in {str(v) for v in [*took_part.values(), *stored.values()]}
    # FR-PBG-010: outside the budgeting module nothing in the ballot box can be read or joined. The
    # test database user is a superuser, which row-level security never applies to, so this reads as
    # an ordinary role, as the API's own database user would.
    db_session.execute(text(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_app_user') THEN
                CREATE ROLE test_app_user;
            END IF;
            GRANT USAGE ON SCHEMA ballot, npm TO test_app_user;
            GRANT SELECT ON ALL TABLES IN SCHEMA ballot TO test_app_user;
            GRANT SELECT ON npm.member TO test_app_user;
        END
        $$;
        """
    ))
    join = "SELECT count(*) FROM ballot.participation p JOIN npm.member m ON m.id = p.member_id WHERE p.cycle_id = :c"
    try:
        db_session.execute(text("SET ROLE test_app_user"))
        db_session.execute(text("SELECT set_config('ballot.firewall', '', true)"))
        joined = db_session.scalar(text(join), {"c": cycle_id})
        ballots_seen = db_session.scalar(text("SELECT count(*) FROM ballot.ballot"))
        db_session.execute(text("SELECT set_config('ballot.firewall', 'open', true)"))
        opened = db_session.scalar(text(join), {"c": cycle_id})
    finally:
        db_session.execute(text("RESET ROLE"))
    assert (joined, ballots_seen, opened) == (0, 0, 1)
    # Nobody's ballot is written to the audit log with the voter or the moment.
    audited = db_session.scalar(text("SELECT count(*) FROM ops.audit_log WHERE actor_id = :m AND occurred_at >= :t"),
                                {"m": member.id, "t": START})
    assert audited == 0


def test_two_people_certify_the_same_reproduced_count_and_results_show_totals_only(
        client, auth, manager, certifier, super_admin, area, voter, db_session, clock):
    cycle_id, (first, second) = ready_cycle(client, auth, manager, area, db_session)
    member = voter()
    clock(timedelta(minutes=90))
    for choices in ([first], [first, second], [second]):
        assert client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": choices},
                           headers=auth(voter())).status_code == 201
    early_close = client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "voting_closed"}, headers=auth(manager))
    early_count = client.get(f"/v1/pb/manage/cycles/{cycle_id}/recount", headers=auth(certifier))

    clock(timedelta(hours=3))
    closed = client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "voting_closed"}, headers=auth(manager)).json()
    recount = client.get(f"/v1/pb/manage/cycles/{cycle_id}/recount", headers=auth(certifier)).json()
    one = client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(certifier))
    twice = client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(certifier))
    not_yet = client.get(f"/v1/pb/cycles/{cycle_id}/results", headers=auth(member))
    two = client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(super_admin))
    results = client.get(f"/v1/pb/cycles/{cycle_id}/results", headers=auth(member)).json()
    rerun = client.get(f"/v1/pb/manage/cycles/{cycle_id}/recount", headers=auth(certifier)).json()

    assert problems(early_close) == ["voting_still_open"] and problems(early_count) == ["voting_not_closed"]
    assert closed["status"] == "voting_closed" and (closed["participation"], closed["ballots"]) == (3, 3)
    assert closed["eligibleCount"] >= 4
    assert recount["chainValid"] is True and recount["matchesCertified"] is None
    assert {t["projectId"]: t["votes"] for t in recount["totals"]} == {first: 2, second: 2}
    assert one.json()["status"] == "voting_closed" and len(one.json()["certifications"]) == 1
    assert (twice.status_code, twice.json()["detail"]) == (403, "already_certified_by_you")
    assert problems(not_yet) == ["results_not_certified"]
    assert two.json()["status"] == "results_certified" and rerun["matchesCertified"] is True
    # Totals only, and with fewer than 10 ballots not even the per-project counts (small numbers).
    assert results["ballots"] == 3 and results["countsShown"] is False
    assert [row["votes"] for row in results["rows"]] == [None, None]
    # Equal votes: the cheaper project ranks first; 600,000 + 700,000 fit in 1,500,000.
    assert [(row["project"]["id"], row["rank"], row["funded"]) for row in results["rows"]] == [
        (first, 1, True), (second, 2, True)]
    assert len(results["certifications"]) == 2 and "certifiedBy" not in results["certifications"][0]
    assert all(set(row) == {"project", "votes", "rank", "funded", "allocated", "spent", "completedOn"}
               for row in results["rows"])


def test_a_count_that_does_not_match_participation_blocks_certification(client, auth, manager, certifier, area, voter,
                                                                         db_session, clock):
    cycle_id, (first, _) = ready_cycle(client, auth, manager, area, db_session)
    clock(timedelta(minutes=90))
    for _ in range(2):
        client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": [first]}, headers=auth(voter()))
    clock(timedelta(hours=3))
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "voting_closed"}, headers=auth(manager))
    db_session.execute(text("SELECT set_config('ballot.firewall', 'open', true)"))
    db_session.execute(text("SELECT set_config('ballot.maintenance', 'on', true)"))
    db_session.execute(text("DELETE FROM ballot.participation WHERE ctid IN (SELECT ctid FROM ballot.participation "
                            "WHERE cycle_id = :c LIMIT 1)"), {"c": cycle_id})
    db_session.execute(text("SELECT set_config('ballot.maintenance', 'off', true)"))

    blocked = client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(certifier))
    logged = db_session.scalar(text("""SELECT count(*) FROM ops.audit_log WHERE action = 'pb.results.certification_blocked'
                                       AND target_id = :c"""), {"c": cycle_id})

    assert problems(blocked) == ["count_mismatch"] and logged == 1
    # A ballot cannot be edited to change the count.
    with pytest.raises(DBAPIError, match="append-only"), db_session.begin_nested():
        db_session.execute(text("SELECT set_config('ballot.firewall', 'open', true)"))
        db_session.execute(text("UPDATE ballot.ballot SET choices = choices WHERE cycle_id = :c"), {"c": cycle_id})


def test_the_recount_finds_a_tampered_chain():
    cycle_id, project = uuid.uuid4(), uuid.uuid4()
    head = rules.genesis_hash(cycle_id)
    ballots = []
    for position in (1, 2):
        ballot_id, receipt = uuid.uuid4(), rules.ballot_receipt_hash(cycle_id, rules.new_receipt_code())
        digest = rules.ballot_hash(head, [project], ballot_id, receipt)
        ballots.append(rules.StoredBallot(ballot_id, position, [project], receipt, head, digest))
        head = digest
    good = rules.recount(cycle_id, ballots, [project])
    swapped = rules.recount(cycle_id, [ballots[0], rules.StoredBallot(
        ballots[1].ballot_id, 2, [uuid.uuid4()], ballots[1].receipt_hash, ballots[1].prev_hash, ballots[1].ballot_hash)],
        [project])
    gap = rules.recount(cycle_id, [ballots[1]], [project])

    assert good.chain_valid and good.totals == {project: 2} and good.head == head
    assert (swapped.chain_valid, swapped.problem) == (False, "ballot_altered")
    assert (gap.chain_valid, gap.problem) == (False, "chain_gap")


def test_allocations_go_to_the_finance_records_with_spending_and_completion_evidence(
        client, auth, manager, certifier, super_admin, treasurer, area, voter, db_session, clock):
    cycle_id, (first, second) = ready_cycle(client, auth, manager, area, db_session, projects=2,
                                            costs=("900000.00", "800000.00"))
    member = voter()
    clock(timedelta(minutes=90))
    for choices in ([first], [first], [second]):
        client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": choices}, headers=auth(voter()))
    clock(timedelta(hours=3))
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "voting_closed"}, headers=auth(manager))
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(certifier))
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(super_admin))

    not_treasurer = client.post(f"/v1/pb/manage/cycles/{cycle_id}/allocations", headers=auth(manager))
    allocated = client.post(f"/v1/pb/manage/cycles/{cycle_id}/allocations", headers=auth(treasurer)).json()
    ledger = db_session.execute(text("SELECT project_id, amount, fund_kind FROM finance.pb_allocation WHERE cycle_id = :c"),
                                {"c": cycle_id}).all()
    spending = {"amount": "500000.00", "spentOn": date.today().isoformat(), "descriptionEn": "Drilling and lining",
                "descriptionTa": "துளையிடலும் சுவர் அமைத்தலும்", "evidenceRef": "Voucher PV-2027-118"}
    too_much = client.post(f"/v1/pb/manage/projects/{first}/expenditures", json={**spending, "amount": "950000.00"},
                           headers=auth(manager))
    unfunded = client.post(f"/v1/pb/manage/projects/{second}/expenditures", json=spending, headers=auth(manager))
    spent = client.post(f"/v1/pb/manage/projects/{first}/expenditures", json=spending, headers=auth(manager))
    done = client.post(f"/v1/pb/manage/projects/{first}/completion", json={
        "completedOn": date.today().isoformat(), "evidenceRef": "Completion certificate CC-77",
        "noteEn": "The well is open and tested safe.", "noteTa": "கிணறு திறக்கப்பட்டு பாதுகாப்பானது என உறுதிசெய்யப்பட்டது.",
    }, headers=auth(manager)).json()
    shown = client.get(f"/v1/pb/projects/{first}", headers=auth(member)).json()

    # 900,000 is funded first (more votes); 800,000 no longer fits in what is left of 1,500,000.
    assert not_treasurer.status_code == 403
    assert allocated["status"] == "allocated" and allocated["allocatedTotal"] == "900000.00"
    assert [(str(p), str(a), k) for p, a, k in ledger] == [(first, "900000.00", "community_fund")]
    assert problems(too_much) == ["spending_exceeds_allocation"] and problems(unfunded) == ["not_allocated"]
    assert spent.status_code == 201 and done["status"] == "implemented"
    assert shown["funded"] is True and shown["allocated"] == "900000.00" and shown["spent"] == "500000.00"
    assert shown["completion"]["evidenceRef"] == "Completion certificate CC-77"
    with pytest.raises(DBAPIError, match="append-only"), db_session.begin_nested():
        db_session.execute(text("UPDATE finance.pb_allocation SET amount = 1 WHERE cycle_id = :c"), {"c": cycle_id})


def test_closing_rewrites_participation_in_member_order_and_retention_leaves_totals(
        client, auth, manager, certifier, super_admin, area, voter, db_session, clock):
    cycle_id, (first, _) = ready_cycle(client, auth, manager, area, db_session)
    clock(timedelta(minutes=90))
    voters = [voter() for _ in range(3)]
    for person in voters:
        client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": [first]}, headers=auth(person))
    clock(timedelta(hours=3))
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/move", json={"to": "voting_closed"}, headers=auth(manager))
    db_session.execute(text("SELECT set_config('ballot.firewall', 'open', true)"))
    stored = list(db_session.scalars(text("SELECT member_id FROM ballot.participation WHERE cycle_id = :c ORDER BY ctid"),
                                      {"c": cycle_id}))
    db_session.execute(text("SELECT set_config('ballot.firewall', '', true)"))
    assert [str(m) for m in stored] == sorted(str(p.id) for p in voters)

    client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(certifier))
    client.post(f"/v1/pb/manage/cycles/{cycle_id}/certify", headers=auth(super_admin))
    purged_now = budgeting.purge_expired(db_session, datetime.now(UTC))
    purged_later = budgeting.purge_expired(db_session, datetime.now(UTC) + timedelta(days=400))
    results = client.get(f"/v1/pb/cycles/{cycle_id}/results", headers=auth(voters[0])).json()

    assert (purged_now, purged_later) == (0, 3)
    assert results["ballots"] == 3 and results["rows"][0]["funded"] is True


def test_no_ballots_while_an_election_silence_covers_the_area(client, auth, manager, area, voter, db_session, clock, silence):
    cycle_id, (first, _) = ready_cycle(client, auth, manager, area, db_session)
    silence(area, "district")
    clock(timedelta(minutes=90))

    refused = client.post(f"/v1/pb/cycles/{cycle_id}/ballot", json={"choices": [first]}, headers=auth(voter()))

    assert problems(refused) == ["election_silence"]


def test_staff_outside_the_area_or_without_permission_are_refused(client, auth, area, create_member, assign, super_admin,
                                                                  voter):
    other = create_member(verified=True)
    assign(other, "4", "province", "XX", ["pb.manage"], granted_by=super_admin)
    member = voter()

    outside = client.post("/v1/pb/manage/cycles", json=cycle_body(area), headers=auth(other))
    not_staff = client.post("/v1/pb/manage/cycles", json=cycle_body(area), headers=auth(member))

    assert (outside.status_code, outside.json()["detail"]) == (403, "outside_your_area")
    assert not_staff.status_code == 403


def test_eligibility_rules_follow_od36():
    common = {"identity_verified": True, "membership_active": True, "today": date(2027, 1, 1), "min_age": 18,
              "member_area_keys": ["platform", "province:9", "district:LK41"], "cycle_area_key": "district:LK41"}
    assert rules.check_eligibility(birth_date=date(2009, 1, 1), **common) is None  # 18 today
    assert rules.check_eligibility(birth_date=date(2009, 1, 2), **common) == "under_voting_age"
    assert rules.check_eligibility(birth_date=date(1980, 1, 1), **{**common, "cycle_area_key": "district:LK42"}) == (
        "outside_cycle_area")
    assert rules.normalise_receipt("abcd efgh-ijkl mnop") == "ABCDEFGHIJKLMNOP"
    assert rules.normalise_receipt("ABCD-EFGH-IJKL-MNO1") is None
