# home module

The member's Home tab (H01, H02, H04): which layout to show, exactly one next step, the next event nearby, the Promise Tracker's count of promises made for the member's area (M18), and which quick actions, tabs and hub services are open or locked, with the reason and next step for each lock.

**Status: built (Batch 17).** It holds no data of its own: it reads the member's identity review, membership, recovery contact, profile, events and the published promises.

- `rules.py`: the next-step order, the quick actions, the hub order and the feature policy for members who are not yet Verified and Active.
- `service.py`, `router.py`, `schemas.py`: `GET /v1/home`.

BRD v1.1: FR-HOME-001 to 008, 012, 013, BR-014, BR-025, BR-026, BR-048. Notifications (FR-HOME-009 to 011) belong to the messaging module.
