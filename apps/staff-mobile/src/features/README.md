# Staff-app features

- `auth/`: the second-factor gate (`MfaGate`) and the no-role screen (`NoRole`).
- `approvals/`: loading the S13 queues the person's roles allow, and one card per kind of decision.
- `scan/`: the camera scanner (expo-camera) and the large result banner.
- `staff/`: tier and area labels.

**Status: S01 to S03, S08, S09, S13, S14 built (Batch 23).** The check-in entry now refuses to offer scan and roster actions without the staff check-in permission. Offline check-in is wired (`scan/offlineQueue.ts`): scans are kept per staff member in the secure store, the phone registers itself through `/v1/operations/devices` on its first sync, and the server accepts them only once the STF-01 replay window is approved. Volunteer assignments (S10) list and answer offers from `/v1/operations`. Also not built: SLA timers on tasks, S04 assisted verification, field visits, identity reviews on mobile.

BRD v1.1: FR-STF-001 to 010 (S01 to S04, S08 to S10, S13, S14), FR-FLD-001 to 009, FR-ADM-001, 002 (scanning).
