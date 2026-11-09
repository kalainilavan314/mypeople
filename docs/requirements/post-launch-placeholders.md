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
| `app/(member)/assistance` and `src/features/assistance` | Confidential support requests, status, appeals, disaster support; M11-M14, M35-M36; FR-AST-001-013, FR-DIS-001-008, BR-102-108 | Approved assistance policy and purpose separation; help cannot depend on membership or contributions |
| `app/(member)/ideas` and `src/features/development` | One Ideas area for H13 and M15-M17, proposal stages and later budgeting M24-M27; FR-IDEA-001-004, FR-DEV-001-008, FR-PBG-001-010 | Phase 2/3 rules; D15 reviews proposals |
| `app/(member)/issues` and `src/features/issues` | H05-H09 issue reporting, receipt and case tracking; voice M43 is an input to H07; FR-RPT-001-017 | Phase 2 case workflow W03-W08; voice is Phase 3 |
| `app/(member)/promises` and `src/features/promises` | Promise Tracker and scorecards M18-M20; FR-PRM-001-010, FR-ACS-001-008 | Publication and scorecard policy |
| `src/features/assistant` | M28 Tamil AI assistant with approved-source citations; FR-AIA-001-010 and §15B.6 | OD-42 provider and hosting decision |
| `src/features/finance` | H17-H18 bank-slip contributions and M51-M52 payments; FR-FUND-001-011, FR-PAY-001-014 | Finance policy; gateway additionally needs OD-07 and OD-27 |

The member app's existing profile, card, household and gallery code remains in
its working locations. `src/features/finance` being absent does not mean the
M1.4 database foundation is absent.

## Staff mobile

| Future location | Scope and requirements | Dependency |
| --- | --- | --- |
| `app/(staff)/assisted-verification` | S04 assisted identity capture, witness checklist and member handoff; FR-STF-004, FR-IDV-014, BR-010, BR-144 | OD-04; the review queue stays in admin W01/W02 |
| `app/(staff)/field-visits` | S05-S07 encrypted offline visits and later sync; FR-FLD-001-009 | Device registration, secure storage and sync policy |

## Admin web

| Future location | Scope and requirements | Dependency |
| --- | --- | --- |
| `src/features/ai-monitoring` | D21 model registry, evaluations and inference metrics; FR-IDV-016-017, PRM-30-31, §15B.3/5 | OD-28 and OD-42; no model is in use |
| `src/features/analytics` | Area-scoped KPI dashboards and reports; §4, §17, RPT-01-016, INT-10 | Approved small-group and differencing controls |
| `src/features/assistance` | D13-D14 assistance cases and D26 relief; FR-AST-001-013, FR-DIS-001-008 | Assistance policy and purpose separation |
| `src/features/elections` (rest of D22) | Periods, silence windows and labelled notices are built; still to come: the volunteer duty roster FR-ELX-005-007, polling information FR-ELX-002-003 and the election-period report FR-ELX-009 | API endpoints for these (not built); PRM-49; POL-12 legal review |
| `src/features/finance` | D10-D11 contribution queue, second approval, reconciliation and ledger; FR-FUND-001-011, FR-ADM-008, FR-PAY-001-014, BR-050/052, CMP-02 | Approved finance policy |
| `src/features/issues` | W03-W08 GN-to-executive case workflow; FR-WEB-014-029, FR-RPT-001-017 | Phase 2 issue module |
| `src/features/privacy` (rest of D35) | The data-subject request register is built; still to come: policy approvals (the §16.11 policy matrix, owner and approver) and consent statistics per purpose | API endpoints for these (not built); DPO role |
| `src/features/promises` | D16-D17 promises, approvals and scorecard periods; FR-PRM-001-010, FR-ACS-001-008 | Promise and scorecard publication policies |
