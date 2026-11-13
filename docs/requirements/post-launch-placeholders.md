# Post-launch module inventory

This is the single record for unbuilt app modules. Paths name future implementation
locations from the screen map; a path listed here does not mean a route exists.
Do not link unbuilt modules from production navigation. Recreate a feature folder
only when its first working code is added, and update this inventory then.

The M1.7 plan named 22 placeholder folders. At cleanup time, 19 folders were
README-only and genuinely unbuilt. Other README-only folders describe working
code elsewhere or shared infrastructure and are retained.

## Member mobile

| Future location | Scope and requirements | Dependency |
| --- | --- | --- |
| `app/(member)/support` (disaster part) | Disaster and emergency support M35-M36; FR-DIS-001-008. Community Support M11-M14 is built in `app/(member)/support` (Phase 2) | Phase 3; official alert relay needs DEP-23 |
| `app/(member)/budgeting` | Participatory budgeting M24-M27; FR-PBG-001-010. Ideas and proposals (H13, M15-M17) are built in `app/(member)/ideas` (Phase 2) | Phase 3 rules |
| `src/features/assistant` | M28 Tamil AI assistant with approved-source citations; FR-AIA-001-010 and §15B.6 | OD-42 provider and hosting decision |
| `src/features/finance` | H17-H18 bank-slip contributions and M51-M52 payments; FR-FUND-001-011, FR-PAY-001-014 | Finance policy; gateway additionally needs OD-07 and OD-27 |

The member app's existing profile, card, household and gallery code remains in
its working locations. `src/features/finance` being absent does not mean the
M1.4 database foundation is absent.

## Staff mobile

| Future location | Scope and requirements | Dependency |
| --- | --- | --- |
| `app/(staff)/assisted-verification` | S04 assisted identity capture, witness checklist and member handoff; FR-STF-004, FR-IDV-014, BR-010, BR-144 | OD-04; the review queue stays in admin W01/W02 |

## Admin web

| Future location | Scope and requirements | Dependency |
| --- | --- | --- |
| `src/features/ai-monitoring` | D21 model registry, evaluations and inference metrics; FR-IDV-016-017, PRM-30-31, §15B.3/5 | OD-28 and OD-42; no model is in use |
| `src/features/analytics` | Area-scoped KPI dashboards and reports; §4, §17, RPT-01-016, INT-10 | Approved small-group and differencing controls |
| `src/features/assistance` (relief part) | D26 disaster relief; FR-DIS-001-008. D13-D14 Community Support is built at `/support` (Phase 2) | Phase 3 |
| `src/features/elections` (rest of D22) | Periods, silence windows, labelled notices, the duty roster (FR-ELX-005-007) and the period report (FR-ELX-009) are built; still to come: polling information FR-ELX-002-003 (M29) | DEP-19 legal opinion; OD-37 election data sources |
| `src/features/finance` | D10-D11 contribution queue, second approval, reconciliation and ledger; FR-FUND-001-011, FR-ADM-008, FR-PAY-001-014, BR-050/052, CMP-02 | Approved finance policy |
| `src/features/privacy` (rest of D35) | The data-subject request register is built; still to come: policy approvals (the §16.11 policy matrix, owner and approver) and consent statistics per purpose | API endpoints for these (not built); DPO role |
