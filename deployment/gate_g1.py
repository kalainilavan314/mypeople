"""Validate a G1 evidence record without activating a release or reading secrets.

This checks completeness and arithmetic, not the authenticity of external reports.
The sponsor and release operator must inspect the referenced evidence separately.
"""

from __future__ import annotations

import argparse
import calendar
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

APPS = ("memberMobile", "staffMobile", "adminWeb")
SIGNERS = ("sponsor", "tier5", "dpo", "vendor")
KEY_AREAS = ("tokenSigning", "nicPepper", "cardHmac", "evidenceEncryption", "credentialSalt")
COMMIT = re.compile(r"^[0-9a-f]{40}$")


def _object(value: Any, label: str, fields: set[str], issues: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        issues.append(f"{label}: object required")
        return {}
    for name in sorted(fields - value.keys()):
        issues.append(f"{label}.{name}: missing")
    for name in sorted(value.keys() - fields):
        issues.append(f"{label}.{name}: unexpected field")
    return value


def _ref(value: Any, label: str, issues: list[str]) -> None:
    if not isinstance(value, str) or not 3 <= len(value.strip()) <= 200 or any(ord(c) < 32 for c in value):
        issues.append(f"{label}: evidence reference required (3-200 printable characters)")


def _count(value: Any, label: str, issues: list[str]) -> int | None:
    if type(value) is not int or value < 0:
        issues.append(f"{label}: non-negative integer required")
        return None
    return value


def _time(value: Any, label: str, issues: list[str]) -> datetime | None:
    if not isinstance(value, str):
        issues.append(f"{label}: ISO timestamp with timezone required")
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None or parsed.utcoffset() is None:
        issues.append(f"{label}: ISO timestamp with timezone required")
        return None
    if parsed > datetime.now(timezone.utc):
        issues.append(f"{label}: future evidence is not accepted")
    return parsed


def _one_calendar_month_after(start: datetime) -> datetime:
    year, month = start.year, start.month + 1
    if month == 13:
        year, month = year + 1, 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return start.replace(year=year, month=month, day=day)


def _coverage(record: Any, label: str, issues: list[str]) -> None:
    fields = {"inventoryRef", "apps"}
    group = _object(record, label, fields, issues)
    _ref(group.get("inventoryRef"), f"{label}.inventoryRef", issues)
    apps = _object(group.get("apps"), f"{label}.apps", set(APPS), issues)
    for app in APPS:
        item = _object(apps.get(app), f"{label}.apps.{app}", {"total", "passed", "evidenceRef"}, issues)
        total = _count(item.get("total"), f"{label}.apps.{app}.total", issues)
        passed = _count(item.get("passed"), f"{label}.apps.{app}.passed", issues)
        _ref(item.get("evidenceRef"), f"{label}.apps.{app}.evidenceRef", issues)
        if total == 0 or (total is not None and passed is not None and passed != total):
            issues.append(f"{label}.apps.{app}: every inventoried item must pass")


def _pilot(record: Any, issues: list[str]) -> None:
    label = "pilot"
    fields = {"startedAt", "endedAt", "gnCodes", "definitionRef", "measurementRef",
              "registrationStarted", "registrationCompleted", "reviewsDecided", "reviewsWithinFiveWorkingDays"}
    pilot = _object(record, label, fields, issues)
    start = _time(pilot.get("startedAt"), "pilot.startedAt", issues)
    end = _time(pilot.get("endedAt"), "pilot.endedAt", issues)
    if start and end and end < _one_calendar_month_after(start):
        issues.append("pilot: one calendar month of observation required")
    codes = pilot.get("gnCodes")
    if not isinstance(codes, list) or not codes or any(not isinstance(c, str) or not c.strip() for c in codes) or len(codes) != len(set(codes)):
        issues.append("pilot.gnCodes: distinct pilot GN codes required")
    _ref(pilot.get("definitionRef"), "pilot.definitionRef", issues)
    _ref(pilot.get("measurementRef"), "pilot.measurementRef", issues)
    started = _count(pilot.get("registrationStarted"), "pilot.registrationStarted", issues)
    completed = _count(pilot.get("registrationCompleted"), "pilot.registrationCompleted", issues)
    decided = _count(pilot.get("reviewsDecided"), "pilot.reviewsDecided", issues)
    on_time = _count(pilot.get("reviewsWithinFiveWorkingDays"), "pilot.reviewsWithinFiveWorkingDays", issues)
    if started is not None and completed is not None:
        if started == 0 or completed > started or 100 * completed < 70 * started:
            issues.append("pilot: registration completion must be at least 70% of starts")
    if decided is not None and on_time is not None:
        if decided == 0 or on_time > decided or 100 * on_time < 90 * decided:
            issues.append("pilot: at least 90% of decided reviews must meet five working days")


def check_evidence(record: Any, candidate_commit: str) -> list[str]:
    """Return every missing or failed G1 criterion; never mark a release live."""
    issues: list[str] = []
    root = _object(record, "record", {"schemaVersion", "candidateCommit", "uat", "accessibility",
                                      "penetration", "accessReview", "keyAudit", "pilot", "signoffs"}, issues)
    if type(root.get("schemaVersion")) is not int or root.get("schemaVersion") != 1:
        issues.append("schemaVersion: expected 1")
    if not COMMIT.fullmatch(candidate_commit) or root.get("candidateCommit") != candidate_commit:
        issues.append("candidateCommit: must match the reviewed 40-character commit")
    _coverage(root.get("uat"), "uat", issues)
    _coverage(root.get("accessibility"), "accessibility", issues)
    pen = _object(root.get("penetration"), "penetration", {"independentTester", "reportRef", "openCritical", "openHigh"}, issues)
    _ref(pen.get("independentTester"), "penetration.independentTester", issues)
    _ref(pen.get("reportRef"), "penetration.reportRef", issues)
    for severity in ("openCritical", "openHigh"):
        count = _count(pen.get(severity), f"penetration.{severity}", issues)
        if count is not None and count != 0:
            issues.append(f"penetration.{severity}: must be zero")
    access = _object(root.get("accessReview"), "accessReview", {"totalGrants", "certifiedGrants", "tier5Ref", "evidenceRef"}, issues)
    total = _count(access.get("totalGrants"), "accessReview.totalGrants", issues)
    certified = _count(access.get("certifiedGrants"), "accessReview.certifiedGrants", issues)
    if total == 0 or (total is not None and certified is not None and certified != total):
        issues.append("accessReview: every Tier 1-5 grant must be certified")
    _ref(access.get("tier5Ref"), "accessReview.tier5Ref", issues)
    _ref(access.get("evidenceRef"), "accessReview.evidenceRef", issues)
    key = _object(root.get("keyAudit"), "keyAudit", {"reportRef", *KEY_AREAS}, issues)
    _ref(key.get("reportRef"), "keyAudit.reportRef", issues)
    for area in KEY_AREAS:
        if key.get(area) is not True:
            issues.append(f"keyAudit.{area}: review must pass")
    _pilot(root.get("pilot"), issues)
    signoffs = _object(root.get("signoffs"), "signoffs", set(SIGNERS), issues)
    pilot_end = _time(root.get("pilot", {}).get("endedAt") if isinstance(root.get("pilot"), dict) else None,
                      "pilot.endedAt", [])
    for signer in SIGNERS:
        item = _object(signoffs.get(signer), f"signoffs.{signer}", {"recordRef", "signedAt"}, issues)
        _ref(item.get("recordRef"), f"signoffs.{signer}.recordRef", issues)
        signed_at = _time(item.get("signedAt"), f"signoffs.{signer}.signedAt", issues)
        if signed_at and pilot_end and signed_at < pilot_end:
            issues.append(f"signoffs.{signer}: must follow pilot completion")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Check G1 evidence completeness; never deploys or enables flags")
    parser.add_argument("--evidence", type=Path, required=True, help="Private aggregate-only evidence record")
    parser.add_argument("--commit", required=True, help="Reviewed full Git commit SHA")
    args = parser.parse_args()
    try:
        if args.evidence.stat().st_size > 1_000_000:
            raise ValueError("evidence file exceeds 1 MB")
        record = json.loads(args.evidence.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError) as error:
        print(f"NOT READY: evidence could not be read ({type(error).__name__})")
        return 2
    issues = check_evidence(record, args.commit)
    if issues:
        print("NOT READY: G1 evidence is incomplete or fails a threshold")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print("EVIDENCE RECORD COMPLETE: independently inspect report authenticity and approve release separately")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
