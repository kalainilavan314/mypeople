# Election mode administration (D22)

BRD v1.1 D22; requirements FR-ELX-001, 004, 008, 010, NFR-ELC-01, 03, 05, 06, 08; PRM-48 (`election.mode.manage`, Tier 5).

**Status: Built** (periods, silence windows and notices), on `/v1/election`.

- `/elections`: declared, ended and withdrawn periods with area, dates, silence window (in effect, not started, over or stopped) and polling day.
- `/elections/new`: declare a period from an Election Commission publication; the API's problems come back next to their fields, and an overlap with another declared period is shown as a warning on the period's page.
- `/elections/[id]`: the period, its official source and its notices; publish a notice labelled Election Commission information or Party information; withdraw a notice; end the period or withdraw it if declared in error.

No voter data is collected or shown (FR-ELX-010). The duty roster, polling information and the period's report are not built in the API yet (`docs/requirements/post-launch-placeholders.md`).
