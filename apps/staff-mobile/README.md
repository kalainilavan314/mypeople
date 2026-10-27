# My People staff app (Expo)

The coordinators' and caseworkers' app (BRD §11.30, screens S01–S18). It is a separate app from the member app, as BRD §15A.5 recommends, so the public member app carries no staff features (OD-26). It shares `packages/` with the member app, including the screen components, the stored session and the data hooks in `packages/mobile-ui`.

**Status: staff core built (Batch 23):**

| Screen | What it does |
|---|---|
| S01 sign-in and role context | Own account, then an authenticator code every session (set up on first use, with a QR code); without a role that counts now the app explains why. The Role tab lists every role, its area, permissions and review date |
| S02 tasks and area | Identity review counts, approvals waiting, events, member look-up: only what the person's roles allow |
| S03 member look-up | One member by exact member ID in the person's areas, minimal fields; outside them the same "not found" |
| S08 check-in | The camera reads event passes and member cards; when it cannot, the member ID with a reason (FR-VOI-007) |
| S09 roster | Expected and attended, each check-in marked scanned or manual |
| S13 approvals | Broadcasts above district scope, area changes with the proof, albums to publish or return, photo removal requests (escalated at 18 hours) |
| S14 alerts | The person's own notices |

Not built: S04 assisted verification (OD-04), S10 volunteers, S11 and S12 assistance cases, field visits, offline use and device registration with remote wipe (FR-STF-010), screenshot blocking on evidence. Identity reviews are decided on the dashboard. The Tamil text in `src/i18n/ta.ts` is new and needs a Tamil speaker's review.

## Run

```powershell
copy .env.example .env.local      # EXPO_PUBLIC_API_URL: the public API address only
npm run web --workspace @my-people/staff-mobile -- --port 8082   # browser preview
npm run android --workspace @my-people/staff-mobile
```

The web preview has no camera scanning on most desktops; the member-ID route works there. The checks are the same as the member app (`apps/member-mobile/README.md`).

## Layout

```text
app/
  _layout.tsx          fonts, saved language, session
  (auth)/sign-in.tsx   S01
  (staff)/_layout.tsx  the gate: second factor, then a role; StaffProvider
  (staff)/(tabs)/      Home (S02), Check-in (S08), Approvals (S13), Alerts (S14), Role (S01)
  (staff)/checkin/[id].tsx, roster/[id].tsx, card-check.tsx, lookup.tsx
src/
  features/            auth (MfaGate, NoRole), approvals, scan (Scanner, ResultBanner), staff
  i18n/                the staff app's Tamil and English text
  lib/                 API address, error messages, language
  providers/           StaffProvider (roles and permissions)
```
