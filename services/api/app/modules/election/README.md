# election module

Election periods, silence windows and election information (BRD D22, NFR-ELC-01 to 09, FR-ELX-001 to 010, BR-119, BR-129 to BR-131, CMP-14).

**Status: periods, silence controls, notices and the member banner built (Batch 20); the volunteer duty roster, polling information, the election-period report and contribution tagging not built yet.** The election-mode policy (POL-12) is not signed off, so what counts as campaign content is an assumption recorded in `rules.py`.

- `rules.py`: period checks (the silence window inside the period and covering the whole polling day), notice sources and their two labels, the countdown.
- `repository.py`: SQL for `election.period` and `election.notice` (Alembic `0018`), and the area and time overlap queries.
- `service.py`: declaring, ending or withdrawing periods; publishing and withdrawing notices; the member banner; `refuse_if_silent()` and `silences()` for other modules.
- `router.py`, `schemas.py`: `/v1/election`. Staff endpoints need `election.mode.manage` (PRM-48, Tier 5). `GET /v1/election/current` is behind the `election_mode` feature flag.

Silence controls in other modules: event and album publishing is refused (`silence_period`), an event may not take place inside a silence window, and scheduled announcement broadcasts are held until the silence ends. Every block and hold is audited.

Not built yet: FR-ELX-002 and 003 (voter-registration link, polling information; INT-19, OD-37), FR-ELX-005 to 007 (duty roster, PRM-49), FR-ELX-009 (the period's audit report), NFR-ELC-02 (change freeze and monitoring, an operating procedure), NFR-ELC-04 (contribution tagging, with the finance module).
