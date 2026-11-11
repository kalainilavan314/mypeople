# Gate G1 and Phase 1 pilot evidence

**Status: not approved.** This is the acceptance procedure for M1.8, not a
declaration that the new stack is live or that Gate G1 has passed. No pilot,
independent penetration test, full manual accessibility audit, or four-party
sign-off is evidenced in this repository. The release operator must keep
production feature flags off until the authorised gate decision is recorded.

## Evidence to collect

| Gate item | Required record | Human verification |
| --- | --- | --- |
| Phase 1 Must UAT | Signed inventory and result report for member mobile, staff mobile, and admin web; every Must item passed. The inventory is [docs/testing/phase1-uat-checklist.md](../testing/phase1-uat-checklist.md); its spreadsheet's Summary sheet gives each app's total and passed counts | Product owner checks coverage against MP-BRD-001 and the screen inventory |
| WCAG 2.2 AA | Screen inventory and per-app audit reports; keyboard, 200% scaling, contrast and touch targets, TalkBack and VoiceOver where relevant | Accessibility reviewer inspects defects and real-device evidence; automated tests alone are insufficient |
| Independent penetration test | Report from an independent tester and remediation/retest records; zero open critical and high findings | Security owner checks tester independence and findings, including all deployed origins and the API |
| Privileged access review | Certification for every active Tier 1-5 grant, with a separate Tier 5 decision reference | D31 covers grants below the reviewer; Tier 5 bootstrap grants require an approved external review procedure |
| Cryptographic key audit | Signed report covering token signing, NIC pepper, card HMAC, evidence encryption, and credential-salt routines | Auditor checks rotation, storage, backup/restore, access and separation without placing key material in the record |
| Pilot | Approved pilot GN list, cohort and working-day definitions, one calendar month of counts, source report | Operations owner checks source counts and confirms registration completion >=70% and decided reviews within five working days >=90% |
| Sign-off | Sponsor, Tier 5 Super Administrator, DPO and vendor decision records after pilot completion | Release operator verifies the actual signatures and authority |

The `pilot.definitionRef` must identify the approved denominator, completion
event, review decision event, working-day calendar and cutoff rules **before**
the pilot is measured. The validator does not infer these from account or
review tables. Avoid publishing small-area counts or member-level exports;
keep the source report in restricted storage and put only aggregate counts and
document references in the evidence record.

## Candidate verification

1. Freeze a candidate commit and a migration head. Use a fresh staging
   database, not the operator's local database, to run Express migrations,
   Alembic to head, and the full API suite. Run all CI jobs for that commit.
   Staging exists since 11 November 2026 ([deployment/staging](../../deployment/staging/README.md));
   it was built from an empty database (Express 0000 to 0011, then Alembic to 0030).
2. Complete the manual UAT, accessibility and security work above. Record
   defects, owners and retests. A failed Must item or open high finding stops
   the gate.
3. Exercise the staged `/v1` API, admin, member and staff flows with synthetic
   accounts using the [go-live runbook](../architecture/fastapi-go-live.md).
   Confirm backup restoration and rollback before directing pilot traffic.
4. After explicit pilot authorisation, run the approved one-month pilot in selected GN divisions with a named
   operator, incident contact and rollback trigger. Record the two cohort
   counts and two review counts from the restricted source report.
5. After the pilot, collect the four formal sign-offs. Copy
   `deployment/gate_g1_evidence.example.json` into the ignored
   `deployment/artifacts/` directory, replace every blank value with an
   evidence-backed result, and run:

   ```powershell
   py -3.12 deployment/gate_g1.py --evidence deployment/artifacts/gate-g1-evidence.json --commit <full-reviewed-commit-sha>
   ```

The input has `schemaVersion: 1`, `candidateCommit`, `uat`, `accessibility`,
`penetration`, `accessReview`, `keyAudit`, `pilot`, and `signoffs`. Both coverage
objects have `inventoryRef` and `apps`, with `memberMobile`, `staffMobile`, and
`adminWeb` entries containing `total`, `passed`, and `evidenceRef`.
`penetration` contains `independentTester`, `reportRef`, `openCritical`, and
`openHigh`. `accessReview` contains `totalGrants`, `certifiedGrants`,
`tier5Ref`, and `evidenceRef`. `keyAudit` contains `reportRef` and five Boolean
checks named in the table. `pilot` contains `startedAt`, `endedAt` (ISO time
with timezone), distinct `gnCodes`, `definitionRef`, `measurementRef`,
`registrationStarted`, `registrationCompleted`, `reviewsDecided`, and
`reviewsWithinFiveWorkingDays`. Each `signoffs` entry (`sponsor`, `tier5`,
`dpo`, `vendor`) contains `recordRef` and `signedAt`.

The command fails closed on missing fields, failed coverage, open critical or
high findings, incomplete access review, a short pilot, missed thresholds, or
missing sign-offs. A zero exit code means **the record is complete**, not that
the documents are genuine or the release is authorised. A human release
decision and the separately approved deployment procedure remain required.

## Current gaps

- The 54-screen manual accessibility audit and the admin rendered-DOM sweep
  are still open in the [accessibility checklist](../development/accessibility-checklist.md).
- The new stack's Must-item UAT, independent penetration report, key audit,
  pilot evidence and four signatures have not been filed here.
- The existing D31 workflow excludes Tier 5 grants. The separate Tier 5
  certification must be approved and recorded before G1.
- Policy-dependent finance, election and assisted-verification features remain
  disabled until their own decisions; G1 does not waive those decisions.
