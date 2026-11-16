# Staff-app features

- `auth/`: the second-factor gate (`MfaGate`) and the no-role screen (`NoRole`).
- `approvals/`: loading the S13 queues the person's roles allow, and one card per kind of decision.
- `scan/`: the camera scanner (expo-camera) and the large result banner.
- `staff/`: tier and area labels.

**Status: S01 to S03, S08, S09, S13, S14 built (Batch 23).** The check-in entry now refuses to offer scan and roster actions without the staff check-in permission. M1.5 volunteer and provisional offline-scan schema exists in the API, but S10 and offline/device workflows are not wired to the app. Also not built: SLA timers on tasks, S04 assisted verification, field visits, identity reviews on mobile.

BRD v1.1: FR-STF-001 to 010 (S01 to S04, S08 to S10, S13, S14), FR-FLD-001 to 009, FR-ADM-001, 002 (scanning).
