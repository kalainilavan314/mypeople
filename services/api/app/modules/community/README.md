# community module

Issues and cases, ideas and proposals, promises, scorecards, surveys and learning.

| Sub-feature | What it does | Status |
|---|---|---|
| `reports/` | The D01 queue of reports made in the PWA (`npm.community_report`) | Built |
| `issues/` | My Area and issue reporting for members (H05 to H09, FR-RPT-001 to 017): `/v1/issues`; photos in the evidence store; stage time limits and alerts (`breaches.py`) | Built, behind `community_issues` |
| `cases/` | The staff case workflow GN to executive (W03 to W08, FR-WEB-014 to 029): `/v1/cases` | Built, behind `community_issues` |
| `ideas/` | Community ideas (H13, FR-IDEA-001 to 004): `/v1/ideas`; moderation for D12 | Built, behind `ideas_surveys` |
| `surveys/` | Surveys (H14, H21, FR-SRV-001 to 006): `/v1/surveys`; anonymous surveys keep no link from answers to members | Built, behind `ideas_surveys` |
| `proposals/` | Our Development Ideas (M15 to M17, D15, FR-DEV-001 to 008 except the AI helpers): `/v1/proposals` | Built, behind `development_proposals` |
| `learning/` | Learning and courses (H15, H16, FR-LRN-001 to 004): `/v1/learning`; progress only on "Complete lesson" | Built, behind `learning` |
| `promises/` | Promise Tracker (M18, M19, D16, FR-PRM-001 to 010): `/v1/promises`; second-person approval, append-only updates, automatic Delayed | Built, behind `promises` |
| `scorecards/` | Accountability scorecard (M20, D17, FR-ACS-001 to 008): `/v1/scorecards`; computed from cases, "Insufficient data" under 10, versioned | Built, behind `scorecards` |
| `townhalls/` | Ask the Leader / Live Town Hall (M21 to M23, D18, FR-THL-001 to 009): `/v1/town-halls`; no session in a silence window | Built, behind `town_halls`; the stream waits for OD-44 |

Not built yet: AI suggestions and semantic search for proposals wait for OD-42.

Stage limits are the BRD 4.3 proposals in working days, Monday to Friday, without public holidays [ASSUMPTION; OD-10].
