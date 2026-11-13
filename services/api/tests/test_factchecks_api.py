"""Misinformation reports and the fact-check queue (BRD M48 reporting part, D12, FR-AUT-006 to 009)."""

import io

import pytest
from PIL import Image


@pytest.fixture
def client(identity_client):
    return identity_client


def png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (400, 300), "white").save(out, format="PNG")
    return out.getvalue()


def test_a_report_needs_a_link_or_screenshot_and_is_decided_by_a_person(client, auth, member_in, area, super_admin, db_session):
    member = member_in(area, verified=True, active=True)

    empty = client.post("/v1/fact-checks/reports", json={"description": "A fake statement is going round."},
                        headers=auth(member))
    shot = client.post("/v1/fact-checks/screenshots", content=png(), headers={**auth(member), "Content-Type": "image/png"}).json()
    sent = client.post("/v1/fact-checks/reports", json={"description": "A fake statement is going round.",
                                                        "screenshotId": shot["id"]}, headers=auth(member)).json()
    queue = client.get("/v1/fact-checks/manage", headers=auth(super_admin)).json()
    image = client.get(f"/v1/fact-checks/manage/{sent['id']}/screenshot", headers=auth(super_admin))
    decided = client.post(f"/v1/fact-checks/manage/{sent['id']}/decision", json={
        "outcome": "false", "reason": "No such statement was issued by the movement."}, headers=auth(super_admin)).json()
    mine = client.get("/v1/fact-checks/reports/mine", headers=auth(member)).json()[0]

    assert empty.json()["detail"]["problems"] == ["link_or_screenshot_required"]
    assert sent["state"] == "pending" and sent["reportRef"].startswith("MR-")
    assert sent["id"] in [r["id"] for r in queue] and image.headers["content-type"] == "image/webp"
    assert decided["outcome"] == "false"
    assert (mine["outcome"], mine["reason"]) == ("false", "No such statement was issued by the movement.")


def test_one_appeal_decided_by_someone_else(client, auth, member_in, area, super_admin, create_member, assign):
    member = member_in(area, verified=True, active=True)
    second = create_member(verified=True)
    assign(second, "3A", "district", area.district, ["content.moderate"], granted_by=super_admin)
    report = client.post("/v1/fact-checks/reports", json={"link": "https://example.org/post/1",
                                                          "description": "This post misquotes our leader."},
                         headers=auth(member)).json()
    client.post(f"/v1/fact-checks/manage/{report['id']}/decision", json={
        "outcome": "accurate", "reason": "The quote matches the recorded speech."}, headers=auth(super_admin))

    appealed = client.post(f"/v1/fact-checks/reports/{report['id']}/appeal", json={"body": "The video was edited before posting."},
                           headers=auth(member)).json()
    twice = client.post(f"/v1/fact-checks/reports/{report['id']}/appeal", json={"body": "Another appeal on the same report."},
                        headers=auth(member))
    same = client.post(f"/v1/fact-checks/manage/{report['id']}/appeal-decision", json={
        "change": False, "reason": "The decision stands after review."}, headers=auth(super_admin))
    changed = client.post(f"/v1/fact-checks/manage/{report['id']}/appeal-decision", json={
        "change": True, "outcome": "misleading", "reason": "The clip was cut to change its meaning."}, headers=auth(second)).json()

    assert appealed["appealState"] == "open"
    assert twice.json()["detail"]["problems"] == ["already_appealed"]
    assert (same.status_code, same.json()["detail"]) == (403, "original_decider")
    assert (changed["appealState"], changed["appealOutcome"]) == ("changed", "misleading")
