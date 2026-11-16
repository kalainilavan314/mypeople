"""Gate G1 arithmetic and fail-closed evidence checks; no production state used."""

import copy
import json
import unittest
from pathlib import Path

from deployment.gate_g1 import check_evidence

COMMIT = "a" * 40


def complete_record() -> dict:
    coverage = {
        "inventoryRef": "signed-inventory-001",
        "apps": {app: {"total": 10, "passed": 10, "evidenceRef": f"report-{app}"}
                 for app in ("memberMobile", "staffMobile", "adminWeb")},
    }
    return {
        "schemaVersion": 1,
        "candidateCommit": COMMIT,
        "uat": copy.deepcopy(coverage),
        "accessibility": copy.deepcopy(coverage),
        "penetration": {"independentTester": "Independent test firm", "reportRef": "report-pen-001", "openCritical": 0, "openHigh": 0},
        "accessReview": {"totalGrants": 5, "certifiedGrants": 5, "tier5Ref": "tier5-review-001", "evidenceRef": "access-review-001"},
        "keyAudit": {"reportRef": "key-audit-001", "tokenSigning": True, "nicPepper": True,
                     "cardHmac": True, "evidenceEncryption": True, "credentialSalt": True},
        "pilot": {"startedAt": "2026-09-01T00:00:00+05:30", "endedAt": "2026-10-01T00:00:00+05:30",
                  "gnCodes": ["GN-001"], "definitionRef": "pilot-definition-001", "measurementRef": "pilot-counts-001",
                  "registrationStarted": 10, "registrationCompleted": 7,
                  "reviewsDecided": 10, "reviewsWithinFiveWorkingDays": 9},
        "signoffs": {role: {"recordRef": f"signed-{role}-001", "signedAt": "2026-10-02T00:00:00+05:30"}
                     for role in ("sponsor", "tier5", "dpo", "vendor")},
    }


class GateG1Tests(unittest.TestCase):
    def test_exact_thresholds_are_accepted_as_complete_record(self) -> None:
        self.assertEqual(check_evidence(complete_record(), COMMIT), [])

    def test_missing_signoff_and_unreviewed_grant_fail(self) -> None:
        record = complete_record()
        del record["signoffs"]["dpo"]
        record["accessReview"]["certifiedGrants"] = 4
        issues = check_evidence(record, COMMIT)
        self.assertTrue(any("signoffs.dpo" in issue for issue in issues))
        self.assertTrue(any("every Tier 1-5 grant" in issue for issue in issues))

    def test_below_pilot_threshold_and_short_pilot_fail(self) -> None:
        record = complete_record()
        record["pilot"]["registrationCompleted"] = 6
        record["pilot"]["reviewsWithinFiveWorkingDays"] = 8
        record["pilot"]["endedAt"] = "2026-09-20T00:00:00+05:30"
        issues = check_evidence(record, COMMIT)
        self.assertTrue(any("70%" in issue for issue in issues))
        self.assertTrue(any("90%" in issue for issue in issues))
        self.assertTrue(any("calendar month" in issue for issue in issues))

    def test_high_finding_and_wrong_commit_fail(self) -> None:
        record = complete_record()
        record["penetration"]["openHigh"] = 1
        issues = check_evidence(record, "b" * 40)
        self.assertTrue(any("openHigh" in issue for issue in issues))
        self.assertTrue(any("candidateCommit" in issue for issue in issues))

    def test_unknown_fields_and_early_signoff_fail(self) -> None:
        record = complete_record()
        record["signoffs"]["sponsor"]["signedAt"] = "2026-09-30T00:00:00+05:30"
        record["accessReview"]["password"] = "must-not-appear"
        issues = check_evidence(record, COMMIT)
        self.assertTrue(any("must follow pilot" in issue for issue in issues))
        self.assertTrue(any("unexpected field" in issue for issue in issues))

    def test_zero_denominators_cannot_pass(self) -> None:
        record = complete_record()
        record["pilot"]["registrationStarted"] = 0
        record["pilot"]["registrationCompleted"] = 0
        record["pilot"]["reviewsDecided"] = 0
        record["pilot"]["reviewsWithinFiveWorkingDays"] = 0
        issues = check_evidence(record, COMMIT)
        self.assertTrue(any("70%" in issue for issue in issues))
        self.assertTrue(any("90%" in issue for issue in issues))

    def test_future_dated_evidence_cannot_pass(self) -> None:
        record = complete_record()
        record["signoffs"]["vendor"]["signedAt"] = "2099-01-01T00:00:00+00:00"
        self.assertTrue(any("future evidence" in issue for issue in check_evidence(record, COMMIT)))

    def test_example_record_is_never_accepted_as_evidence(self) -> None:
        example = Path(__file__).resolve().parents[1] / "gate_g1_evidence.example.json"
        record = json.loads(example.read_text(encoding="utf-8"))
        self.assertTrue(check_evidence(record, COMMIT))


if __name__ == "__main__":
    unittest.main()
