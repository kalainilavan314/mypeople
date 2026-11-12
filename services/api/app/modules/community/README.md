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

Not built yet: FR-PRM, FR-ACS, FR-LRN (`/v1/promises`, `/v1/scorecards`, `/v1/learning`); AI suggestions and semantic search for proposals wait for OD-42.

Stage limits are the BRD 4.3 proposals in working days, Monday to Friday, without public holidays [ASSUMPTION; OD-10].
