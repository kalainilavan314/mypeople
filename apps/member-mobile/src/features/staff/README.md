# Staff section

The coordinators' and caseworkers' screens (BRD §11.30, screens S01–S18) inside the My People app. The owner decided on 12 November 2026 to publish one role-aware app instead of a separate staff app (OD-26), so a staff member installs the same app as every member and signs in with the same account.

- **Who sees it:** a member registers as usual; once the team assigns a tier on the dashboard (Roles and access), Home and Profile show the tier ("Tier 3A · Jaffna district") and a "Staff section" entry, from `GET /v1/access/me` (`useMyStaffRoles`, `StaffRoleTags`). Reading one's own roles needs no authenticator code. Ending the role removes both.
- **What it asks:** opening the section (`app/(member)/staff/_layout.tsx`) asks for the authenticator code in every session, setting the authenticator up the first time (`auth/MfaGate`). Without a role that counts now it explains why (`auth/NoRole`).
- **What the API does:** checks the code and the role again on every staff request, so staff screens in a member's copy of the app grant nothing.
- **Leaving:** every staff tab has a back button in its header, and the Role tab has a button, that returns to the member screens (`LeaveStaffButton`). Signing out stays on the member Profile, since it ends the whole app's session.

**Status: staff core built (Batch 23):**

| Screen | What it does |
|---|---|
| S01 role context | The authenticator code every session (set up on first use, with a QR code); the Role tab lists every role, its area, permissions and review date |
| S02 tasks and area | Identity review counts, approvals waiting, events, member look-up: only what the person's roles allow |
| S03 member look-up | One member by exact member ID in the person's areas, minimal fields; outside them the same "not found" |
| S08 check-in | The camera reads event passes and member cards; when it cannot, the member ID with a reason (FR-VOI-007); offline scans wait on the phone |
| S09 roster | Expected and attended, each check-in marked scanned or manual |
| S13 approvals | Broadcasts above district scope, area changes with the proof, albums to publish or return, photo removal requests (escalated at 18 hours) |
| S14 alerts | The person's own notices |

Not built: S04 assisted verification (OD-04), S11 and S12 assistance cases, field visits, screenshot blocking on evidence. Identity reviews are decided on the dashboard. The Tamil text in `src/i18n/staff/ta.ts` is new and needs a Tamil speaker's review.

## Run

The section runs with the app (`apps/member-mobile/README.md`): sign in with an account that holds a staff role, then open "Staff section" on Home or Profile, or go to `/staff`. The web preview has no camera scanning on most desktops; the member-ID route works there.

## Layout

```text
app/(member)/staff/
  _layout.tsx          the gate: authenticator code, then a role; StaffProvider
  (tabs)/              Home (S02), Check-in (S08), Approvals (S13), Alerts (S14), Role (S01)
  checkin/[id].tsx, roster/[id].tsx, card-check.tsx, lookup.tsx, sessions.tsx, assignments.tsx
src/features/staff/
  auth/                MfaGate, NoRole
  approvals/           the approval queues
  scan/                Scanner, ResultBanner, offlineQueue
  areaLabel.ts         role and area names
  errors.ts            staff error messages ("s.errors.…")
  LeaveStaffButton.tsx back to the member screens
  useMyStaffRoles.ts   the person's roles, for the tier tags and the entry on Home and Profile
  StaffRoleTags.tsx    "Tier 3A · Jaffna district" on Home and Profile
src/providers/StaffProvider.tsx   roles and permissions inside the section
src/i18n/staff/                   the section's Tamil and English text ("s.…")
```
