# analytics module

D32 operational analytics for staff with `analytics.view` (PRM-24), limited to their areas.

**Status: Phase 1 operations figures built (MP-DEC-001 5.2).** `GET /v1/analytics/operations?periodDays=7|30|90` returns the registration funnel (registered, identity sent, verified, Active, completion rate), verification turnaround (decided, median wait, share within 5 working days), the review queue (waiting on a reviewer, past 5 working days) and event attendance (events held, Going, checked in).

- `rules.py`: small-group suppression. A count of 1 to 9 people is hidden, and so is a funnel step whose drop from the step before is 1 to 9, so no small group can be worked out by subtraction. [ASSUMPTION] 10 is GOV-01's proposed minimum, for the DPO to confirm.
- `repository.py`: counts only, never a member row; areas follow `access.visible_areas`.
- Not built: the RPT-15 to RPT-28 dashboards beyond these figures, exports (which must keep the same suppression), device and app quality figures.

Never combine identifiable membership with welfare, health, household, ballot or location data (RR-06); assistance and household figures stay out of this module (RR-07).

BRD v1.1: D32, RR-02, RR-06, RR-07, KPI-01, KPI-04; PRM-24.
