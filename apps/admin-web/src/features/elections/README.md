# Election mode administration (D22)

BRD v1.1 D22; requirements FR-ELX-001, 004, 008, 010, NFR-ELC-01, 03, 05, 06, 08; PRM-48 (`election.mode.manage`, Tier 5).

**Status: Built** (periods, silence windows and notices), on `/v1/election`.

- `/elections`: declared, ended and withdrawn periods with area, dates, silence window (in effect, not started, over or stopped) and polling day.
- `/elections/new`: declare a period from an Election Commission publication; the API's problems come back next to their fields, and an overlap with another declared period is shown as a warning on the period's page.
- `/elections/[id]`: the period, its official source and its notices; publish a notice labelled Election Commission information or Party information; withdraw a notice; end the period or withdraw it if declared in error.

## Election duty roster (S15 on the web, FR-ELX-005 to 007, 009)

PRM-49 (`election.roster.manage`), on `/v1/election/roster`; off until the `election_roster` switch is on.

- `/roster`: the declared periods that cover the coordinator's areas (a GN coordinator sees a district-wide period). Reachable without election mode management.
- `/elections/[id]/roster`: the period's duty shifts in the coordinator's areas, and a new shift inside the election area.
- `/elections/[id]/roster/[shift]`: offer the shift to a Verified and Active member by member code, see answers and check-in times, send an operational message to the volunteers who accepted the shift and see the messages already sent, cancel it with a reason. The period page (`/elections/[id]`) shows the FR-ELX-009 report with the audit entries behind it (ids only).
- `/elections/[id]`: the period report (FR-ELX-009): shifts, roster changes and messages, broadcasts and content published, silence blocks, all in counts.

No voter data is collected or shown (FR-ELX-010): no vote choice, intention or proof of voting, and check-in records no location. Polling information is not built yet (`docs/requirements/post-launch-placeholders.md`).
