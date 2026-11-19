# election module

Election periods, silence windows and election information (BRD D22, NFR-ELC-01 to 09, FR-ELX-001 to 010, BR-119, BR-129 to BR-131, CMP-14).

**Status: periods, silence controls, notices and the member banner built (Batch 20); the duty roster and the period report are in `roster/`; M29 election information and the Election Commission links built (Phase 3, `GET /v1/election/official-links`); contribution tagging not built yet.** The election-mode policy (POL-12) is not signed off, so what counts as campaign content is an assumption recorded in `rules.py`. [ASSUMPTION] DEP-19: the legal opinion on election features is not recorded, so `election_mode` stays off in production until it is; the links in `rules.OFFICIAL_LINKS` are for Legal Counsel to confirm (OD-37), and there is no polling-station locator (`POLLING_STATION_LOCATOR = False`).

- `rules.py`: period checks (the silence window inside the period and covering the whole polling day), notice sources and their two labels, the countdown.
- `repository.py`: SQL for `election.period` and `election.notice` (Alembic `0018`), and the area and time overlap queries.
- `service.py`: declaring, ending or withdrawing periods; publishing and withdrawing notices; the member banner; `refuse_if_silent()` and `silences()` for other modules.
- `router.py`, `schemas.py`: `/v1/election`. Staff endpoints need `election.mode.manage` (PRM-48, Tier 5). `GET /v1/election/current` is behind the `election_mode` feature flag.

Silence controls in other modules: event and album publishing is refused (`silence_period`), an event may not take place inside a silence window, and scheduled announcement broadcasts are held until the silence ends. Every block and hold is audited.

FR-ELX-002 and 003 are met with links only: the app opens the Election Commission's own services and collects nothing (INT-19 has no integration; OD-37 has no authorised polling-station dataset). Not built yet: NFR-ELC-02 (change freeze and monitoring, an operating procedure), NFR-ELC-04 (contribution tagging, with the finance module).
