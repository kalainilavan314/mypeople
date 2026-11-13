# Community cases (W03 to W08)

BRD v1.1 screens W03 to W08; requirements FR-WEB-014 to FR-WEB-029, BR-032, BR-035, BR-037; PRM-07 to PRM-13 (`cases.*`) and `content.moderate`.

**Status: Built** on `/v1/cases` (module switch `community_issues`).

- `/cases`: the queue in the viewer's areas, with counts by stage and overdue, filters for stage, Mine, Overdue and, for Tiers 4 and 5, District closures, and search by case ID or title.
- `/cases/[id]`: one page for the whole case: the reporter's description and photos, observed facts (W03), divisional findings with verified facts kept apart from assumptions (W04), every report and decision version, added information, the full history with each handover (previous owner, new owner, note, time), and the forms for the actions the API allows the viewer now: GN collection, divisional research, district decision (act or escalate), regional plan, executive decision, implementation progress and closing report, handover, closure challenges, notes, public summary and moderation of added information.
- `/evidence/case/[caseId]/[photoId]`: case photos passed through with the staff session, never cached; the API audits each view.

Public summaries waiting to be written (or updated with the outcome after closure) and added information waiting for a moderator are also gathered in `/moderation`, with the same forms; an approval may publish an edited version of added information (D12). Moderation appeals are decided there too.

The reporter's contact is shown only to the case owner, on request, and the API audits each look (PRM-13). Photos sent with a progress or closing report go through a Server Action, which Next.js limits to 1 MB per request, so the form allows at most 0.9 MB of photos per report.

Reports from the older member web app stay in `/reports` (D01).
