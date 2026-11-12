# My People API (FastAPI)

The new Python backend, built as a modular monolith (BRD v1.1, §15A). It runs
alongside the existing Express API in `server/`, which still serves production
under `/api`. This service only answers under `/v1`. Feature endpoints move here
one module at a time, against the same PostgreSQL database.

Current scope:

| Endpoint | What it does |
|---|---|
| `GET /v1/health` | the process is running (no database access) |
| `GET /v1/health/db` | a query runs on PostgreSQL; `503 {"status":"unavailable"}` otherwise |
| `GET /v1/members/me` | the signed-in member's profile; `401` without a valid session |
| `GET /v1/membership/me` | the member's membership state (pending, active, suspended, inactive) and reason code |
| `GET /v1/membership/me/card`, `GET /v1/membership/me/card/code`, `POST /v1/membership/card/scan` | the member card, its 60-second QR code, and scanning (needs `events.checkin_scan`) |
| `GET /v1/membership/awaiting-activation`, `GET /v1/membership/members/{id}`, `POST /v1/membership/members/{id}/changes` | activation, suspension, reinstatement and inactivation; need `members.activate` over the member's area |
| `POST /v1/auth/sign-in` | `{nic, password}` or `{passportNumber, passportCountry, password}` → sets the session cookie, returns `{token, member}`; `401 invalid_credentials`, `429 too_many_attempts` |
| `POST /v1/identity/register` | create an account on the NIC or passport route and sign it in; `409 already_registered`, `422 registration_refused` |
| `GET /v1/identity/notices`, `POST /v1/identity/me/consent`, `GET /v1/identity/me/progress` | notice versions, identity-review consent (needed before any upload), registration steps |
| `GET /v1/geography/districts`, `.../districts/{code}/ds-divisions`, `.../ds-divisions/{code}/gn-divisions` | the area lists, public |
| `GET /v1/events`, `GET /v1/events/{id}`, `PUT /v1/events/{id}/rsvp`, `GET /v1/events/{id}/pass`, `.../pass/code` | events for members: list with filters, detail, RSVP, the event pass and its 60-second QR code |
| `GET /v1/events/manage`, `GET /v1/events/manage/{id}`, `POST /v1/events`, `PATCH /v1/events/{id}`, `POST .../publish`, `.../cancel` | the event console; needs `events.manage` over the event's area |
| `GET`/`PATCH /v1/profile`, `GET /v1/profile/activity`, `GET`/`PUT`/`DELETE /v1/profile/survey-answers`, `GET /v1/profile/identity-data` | the member's profile: locked legal details, display name, gender, and language preference (`ta` or `en`), My Activity, optional survey answers, the identity-data notice |
| `POST /v1/profile/area-changes`, `GET .../mine`, `PUT .../{id}/proof`, `POST .../{id}/withdraw` | GN area-change requests with proof of residence |
| `GET /v1/profile/area-changes`, `GET .../{id}/proof`, `POST .../{id}/decision` | reviewing area changes; needs `members.verify` over the requested area |
| `POST /v1/auth/password` | a new password, only with the current one |
| `POST /v1/privacy/closure-code`, `POST /v1/privacy/requests`, `GET /v1/privacy/requests/mine` | data-subject requests: a copy of one's data, or closing the account |
| `GET /v1/privacy/requests`, `POST .../{id}/decision` | the DPO register; needs `privacy.requests.handle` |
| `GET /v1/notifications`, `POST .../{id}/read`, `POST .../read-all`, `GET`/`PUT .../choices`, `POST .../devices`, `.../devices/unregister` | the in-app inbox (All, Action needed), channel choices and quiet hours, push devices |
| `GET`/`POST /v1/notifications/broadcasts`, `POST .../reach`, `PATCH .../{id}`, `POST .../preview`, `.../submit`, `.../approve`, `.../cancel` | staff broadcasts by area and optional effective staff tier; need `notifications.send` over the area |
| `GET /v1/community/reports/counts`, `GET /v1/community/reports`, `GET /v1/community/reports/{id}` | area-scoped operational reports; need `reports.view`; list/detail access is audited |
| `GET /v1/home` | the Home tab: H01 or H02, one next step, the next event nearby, open and locked features with reasons, the hub |
| `GET /v1/content/albums`, `GET /v1/content/albums/{id}`, `GET /v1/content/photos/{id}/{thumb\|display}` | the gallery for members: published albums, album detail, the photos |
| `POST /v1/content/photos/{id}/removal-requests`, `GET /v1/content/removal-requests/mine`, `POST /v1/content/removal-requests/public` | photo removal requests with receipts, for members and, through a public form, for people who are not |
| `GET /v1/content/albums/manage`, `POST /v1/content/albums`, `PATCH .../albums/{id}`, `POST .../photos`, `PATCH`/`DELETE /v1/content/photos/{id}`, `POST .../submit`, `.../publish`, `.../return` | the media console; needs `gallery.publish` over the album's area |
| `GET /v1/content/removal-requests`, `POST .../{id}/decision` | the 24-hour removal queue; needs `gallery.takedown` over the album's area |
| `POST /v1/events/{id}/scan`, `GET /v1/events/{id}/attendance` | check-in and the attendance roster; need `events.checkin_scan` over the event's area (the roster also opens with `events.manage`) |
| `POST /v1/events/{id}/checkin/manual` | check-in by the member ID on the card when a pass cannot be scanned, with a reason (FR-VOI-007) |
| `GET /v1/features` | the v1.1 modules that are on (public) |
| `GET /v1/features/registry`, `POST /v1/features/{key}/gate`, `.../enable`, `.../disable` | recording phase gates and switching modules; need `system.configure` |
| `GET /v1/election/current` | elections running for the member's area: date, countdown, official source, labelled notices (behind the `election_mode` flag) |
| `GET`/`POST /v1/election/periods`, `GET .../{id}`, `POST .../{id}/close`, `POST .../{id}/notices`, `POST /v1/election/notices/{id}/withdraw` | election periods with their silence windows, and notices; need `election.mode.manage` |
| `GET`/`POST /v1/identity/me/phone`, `POST /v1/identity/me/phone/confirm` | the recovery number, confirmed by a one-time code |
| `POST /v1/auth/recovery/request`, `/verify`, `/reset`, `/assisted` | account recovery by code, a new password, and assisted recovery requests |
| `GET /v1/identity/recovery-requests`, `POST .../{id}/resolve` | the assisted-recovery queue; needs `members.verify` over the member's area |
| `POST /v1/auth/sign-out` | ends every session of the member (`204`) and clears the cookie; an old or ended token only clears the cookie |
| `GET /v1/auth/sessions`, `POST /v1/auth/sessions/{id}/revoke`, `POST /v1/auth/sessions/revoke-others` | the member's signed-in devices; end one or all others |
| `GET /v1/auth/mfa`, `POST /v1/auth/mfa/totp`, `.../totp/confirm`, `POST /v1/auth/mfa/verify` | the staff second factor: enrol an authenticator app, give its code in each session |
| `GET /v1/access/me` | the caller's staff assignments that count now |
| `GET /v1/access/assignments` | assignments in the caller's areas (W09); needs `roles.assign` |
| `GET /v1/membership/lookup?code` | one member by exact member ID in the caller's areas (S03); needs `members.view_profile` |
| `GET /v1/access/catalogue`, `POST /v1/access/assignments/preview`, `POST /v1/access/assignment-previews`, `GET`/`POST .../{id}`, `POST /v1/access/assignments/{id}/revoke` | staff assignments (W09); role grants require a staff-bound durable preview and confirmation |
| `GET /v1/access/reviews`, `POST /v1/access/reviews/{assignmentId}` | this quarter's access review (FR-AUTH-027, D31); need `audit.view` |
| `GET /v1/audit`, `GET /v1/audit/verify` | the audit log and its hash-chain check; need `audit.view` |
| `GET /v1/identity/me/documents`, `PUT /v1/identity/me/documents/{kind}` | which identity images the server holds for the member; upload or replace one (the body is the image) |
| `GET /v1/identity/me/evidence-views` | when a reviewer viewed the member's evidence: date and role only |
| `GET /v1/identity/members/{id}/documents`, `POST /v1/identity/documents/{id}/view-link`, `GET /v1/identity/evidence/{token}` | reviewers list, open (5-minute link) and view identity images; need `members.view_identity_evidence` over the member's area and their own open review of the member |
| `GET /v1/identity/me/review`, `POST /v1/identity/me/review` | the member's identity review (VR reference, state, decisions); submit it, or send a correction |
| `GET /v1/identity/reviews`, `GET /v1/identity/reviews/counts`, `GET /v1/identity/reviews/{id}`, `POST .../claim`, `.../release`, `.../decision` | the reviewers' queue and decisions (W01, W02); need `members.verify` over the member's area |
| `POST /v1/identity/me/review/appeal` | the member appeals their latest Request-update or Unable-to-verify decision, once |
| `GET /v1/identity/appeals`, `GET /v1/identity/appeals/{id}`, `POST .../claim`, `.../release`, `.../decision` | the appeals queue (D05); need `idv.appeal.decide` over the member's area |
| `POST /v1/identity/duplicates` | a reviewer reports a suspected duplicate account (needs `members.verify`) |
| `GET /v1/identity/duplicates`, `GET /v1/identity/duplicates/{id}`, `POST .../claim`, `.../release`, `.../decision` | duplicate investigations (D04); need `idv.duplicate.investigate` over both accounts' areas |
| `GET /v1/fund/config`, `POST /v1/fund/contributions`, `PUT .../{id}/slip`, `POST .../{id}/submit`, `GET .../mine`, `GET .../mine/{id}`, `.../receipt` | community finance member intake: bank details, draft creation, encrypted slip upload, submission, receipts (gated by `community_finance`) |
| `GET /v1/finance/contributions`, `GET .../{id}`, `POST .../{id}/claim`, `POST .../slip-view-token`, `GET /v1/finance/slips/{token}`, `POST .../{id}/reconcile`, `POST .../{id}/approve`, `GET /v1/finance/ledger.csv` | staff finance queue and slip ledger: separation of duties (RB-12), reconciliation, independent approval, short-lived slip streaming, CSV ledger export |

## Staff access (BRD §9)

Access is a tier, explicit permissions and an area, held as rows in
`access.staff_assignment`. `app/core/permissions.py` encodes the
BRD's permission matrix (§9.4, §9.8) and `rules.py` the rules RB-01 to RB-07
and RB-12, as plain functions with their own tests. Endpoints declare what
they need with `require_permission("...")`; refused checks return 403 and
are written to the audit log, at most once per person, permission and reason
in 10 minutes: repeats are counted in `ops.denial_tally` and the next entry
reports them as `repeatsHeldBack`, so nobody can flood the log. Every grant and revocation is audited in the
same transaction, and revocations apply on the next request.

The first Super Administrator (Tier 5) has nobody above to grant it. An
operator creates it once, on the server, for a member whose identity is
confirmed:

```powershell
python -m app.modules.access.bootstrap <member-id> --permission members.verify
```

It is refused when a Super Administrator already exists. Everyone else is
assigned through a durable `/v1/access/assignment-previews` record, followed by its one-time `/confirm` route. The Express API still reads its
old `is_admin` flag for its own four staff routes until they move here.

## Registration (BRD A03 to A18, FR-AUTH-010 to 013)

`POST /v1/identity/register` creates an account the way the Express sign-up
does (the same `npm.member` row, member and referral codes, verification
trail), so it can sign in through either API, plus what Express lacks:

- **Route.** NIC or passport, equal options, one per account (BR-003);
  stored in `identity.identity_record`. NICs must be in the old or new
  format; passports need a number matching `PASSPORT_NUMBER_PATTERN` and an
  ISO country code. The number is stored only as a peppered hash
  (`nic_hash`, or `passport_hash` with the country), one unique index
  covering both routes (BR-007). Passport accounts sign in with the number
  and country (FR-AUTH-005); Express has no passport route.
- **Password.** At least 10 characters, not on the common-password list,
  not containing the ID number (FR-AUTH-013).
- **Details.** Language (BR-001); optional date of birth (age 18 or more,
  an assumption until OD-15), gender with "prefer not to say", area chosen
  top-down and checked against the registry (BR-017), referral code (an
  unknown code is reported, not refused), and optional survey answers.
- **Consent.** Accepting the terms is recorded with the notice version;
  identity-review consent (`POST /v1/identity/me/consent`) must be given
  before any image upload (BR-008). Notice versions are drafts until POL-01.
- **Progress.** `GET /v1/identity/me/progress` lists consent, each image
  the route needs and submission, with the next step (FR-AUTH-009).

Identity starts as "Draft" (`nic_format` or `unverified` in Express terms)
and membership as pending; nothing is verified by registering. Referrals are
recorded but, unlike the Express sign-up, never promote anyone's tier
(SG-03). Not built yet: the mobile number and its one-time code, recovery
and registration rate limits (account-security batch).

## Quarterly access reviews (FR-AUTH-027, NFR-SEC-13, D31)

Every staff grant except the Super Administrator's is due for review by the
end of the quarter after it was made or last confirmed, in Sri Lankan time
(`access.rules.review_due`; this replaces RB-05's 12 months, which covered
explicit grants only). `GET /v1/access/reviews` lists the grants a reviewer
may decide this quarter, the most overdue first, with how many were already
reviewed (KPI-42). A reviewer holds `audit.view` (PRM-25) over the grant's
area through a higher tier, and never reviews their own grant, so Tier 4
grants go to the Super Administrator. Confirming makes the grant due a
quarter later; revoking ends it. Each decision is a row in
`access.assignment_review` with its reason and an audit entry with ids only.
A grant nobody reviewed by its deadline already stops counting
(`effective_assignments`); confirming it restores it. The Tier 5 grant is
exempt [ASSUMPTION]: nobody ranks above it, and a lapse would leave nobody
able to assign roles.

## Sessions and the staff second factor (FR-AUTH-018 to 021, 025, NFR-SEC-04, NFR-SEC-12)

- **Sessions.** Sign-in and registration record a row in
  `identity.session` (a coarse device label, never a location) and the token
  names it (`sid`). Members list their devices, end one, or end all others;
  the next request from an ended session is refused, here and by the
  Express API, which checks the same row for any token that names one. A
  session unused for 30 days expires. "Sign out" still ends every session in
  both APIs.
- **New devices.** A sign-in from a device the member has not used before
  sends a notice to their confirmed number. Apps send a stable install id in
  `X-Device-Id`; browsers are told apart by their description.
- **Staff MFA.** Staff add an authenticator app (TOTP, RFC 6238) once and
  give its code in each session; until then every staff endpoint answers
  `403 mfa_enrolment_required` or `mfa_required`, logged as refused access.
  A code works once. Wrong codes count against the authenticator in every
  session: five lock it (`429 mfa_locked` with `Retry-After`) for 15 minutes,
  then 1 hour, 4 hours and 24 hours in a row, until a right code (figures
  are assumptions). No code is checked while it is locked; each wrong code
  and lockout is audited, and the confirmed number is told when it locks.
  Five wrong codes in one session also end that session. The secret is
  encrypted with a key derived from `JWT_SECRET` (changing it means staff
  enrol again). `STAFF_MFA_REQUIRED=false` is allowed only in development.
- **Express tokens** carry no session: they still work for member
  endpoints, end only with "sign out", are not listed, and can never act as
  staff here.

- **Short tokens, rotating refresh tokens (FR-AUTH-025).** This API's tokens
  last 15 minutes (`ACCESS_LIFETIME`); an expired one answers
  `401 token_expired`. Sign-in and registration also return a refresh token,
  `<session id>.<secret>`, kept as a SHA-256 hash on the session with the one
  before it, and set as the `mp_refresh` cookie for `/v1/auth`.
  `POST /v1/auth/refresh` locks the session row, checks the secret before
  saying anything about the session, and returns a new pair. A refresh token
  that was already replaced coming back means someone holds a copy: the
  session ends (`refresh_reuse`) and the member gets an alert. Express tokens
  are unaffected (still 30 days).
- **Suspicious sign-ins (FR-AUTH-018, NFR-SEC-12).** `auth/risk.py` flags a
  sign-in after three or more wrong passwords for the account in the past
  hour from any address, or the sixth sign-in within an hour; a new device
  is listed as a signal only beside one of those (alone it gets the
  new-device notice). A flagged sign-in still succeeds, and raises a
  `security_alert`: an Action-needed inbox notice, an SMS to the confirmed
  number, and an audit entry. The member answers through
  `/v1/auth/security-alerts`; "this wasn't me" ends the flagged session and
  every other one except the one they are using. No address or location is
  stored with an alert, so impossible travel is not a signal.

Not built yet: step-up codes for new devices (FR-AUTH-022), alerts to the
old device (needs push), passkeys, and lost-device wipe (FR-STF-010).

## Recovery (BRD A13, A16, FR-REG-028, FR-AUTH-014 to 017)

- **Recovery number.** A number becomes the recovery contact only after the
  member enters the code sent to it; it is also copied to `npm.member.phone`
  for the live app. Changing it later sends a notice to the old number.
  Asking for the code answers the same whether or not another account has
  the number, after the rate limits; only a correct code reveals the clash
  (`409 phone_unavailable`), so nobody can probe which numbers are registered.
- **One-time codes** use the Express table `npm.otp`, hashed the same way
  (HMAC under `JWT_SECRET`), with the same limits: one a minute, five an
  hour and ten a day per number and purpose, ten per address in ten minutes
  for any purpose, five guesses per code. Counting per purpose means codes
  asked for through Express never use up a member's recovery allowance;
  Express accepts only its own purposes (`signup`, `login`, `reset`), so it
  cannot cancel or burn this API's codes. Recovery codes last 10 minutes,
  confirmation codes 5.
- **Recovery.** A code goes only to the confirmed contact, and the answer is
  the same whether or not the ID number is registered (BR-023). The code is
  stored in the request and the SMS sent after the answer, so neither its
  timing nor a provider failure tells which numbers are registered. A correct
  code gives a 10-minute reset token; the new password ends every session
  and the contact is told. This also covers moving to a new phone.
- **Assisted recovery.** Anyone can ask for help with an AR reference; the
  request reaches reviewers with `members.verify` over the member's area
  (an assumption: the BRD names no support permission). After checking the
  person's identity a reviewer can replace the recovery number, but only on
  an account whose staff tiers all rank below the reviewer's
  (`403 target_outranks_you`).
- **SMS.** `app/integrations/sms.py` sends through an interface (INT-01).
  `SMS_PROVIDER=notify_lk` sends through Notify.lk, the owner's choice of
  12 November 2026: a form POST to its send endpoint with `NOTIFY_LK_USER_ID`,
  `NOTIFY_LK_API_KEY` and `NOTIFY_LK_SENDER_ID`, numbers as `94XXXXXXXXX`, Tamil
  as Unicode. The API refuses to start without all three, or with the demo
  sender ID `NotifyDEMO` in production (Notify.lk suspends accounts that send
  codes from it). A refused or unanswered send is `502 sms_failed`; nothing
  about the number, text or key is logged. `SMS_PROVIDER=none` answers
  `503 sms_not_configured`; `SMS_PROVIDER=development` keeps messages in
  memory and returns the code in the response, and is refused outside
  development.
- **Limits.** Five registrations and three assisted-recovery requests per
  address an hour (assumptions).

Not built yet: the 24-hour delay on high-risk actions after a contact change
(no such action exists yet), and sessions, device alerts and staff MFA
(next batch).

## Membership (BRD §9.3, GAP-02, FR-ADM-003)

Membership is its own state: pending, active, suspended or inactive. A
member nobody has activated is pending. A holder of `members.activate` over
the member's area changes it, never on their own record, always with a
reason code (and a note when the reason is "other"); each change is kept in
`membership.membership_change`, which cannot be edited, and in the audit log.
A staff member's membership is changed only by someone whose tier ranks
above every tier they hold (`403 target_outranks_you`), so nobody suspends a
peer or a senior; nobody outranks the Super Administrator.

- Activation needs a confirmed identity; approval of identity does not
  activate membership by itself (BR-014). Automatic activation (OD-02's
  recommendation) is not built until OD-02 is decided.
- Staff rights need an Active membership as well as a confirmed identity
  (BR-097): assignments are refused for others, and a member's existing
  assignments stop counting while they are suspended or inactive.
- The bootstrap command activates the first Super Administrator, whom
  nobody else could activate.

The reason codes are proposed, not from the BRD, and need sponsor
confirmation. Not built yet: notifying the member, revoking card tokens on
suspension (FR-CARD-015), and how existing members are migrated at go-live.

## Member card (BRD C01 to C06, FR-CARD-001 to 004, 007, 012, 014, 015, FR-ADM-001)

- The card exists only while identity is Verified and membership Active
  (BR-065); otherwise `GET /v1/membership/me/card` explains why (C06). It
  never contains the NIC or passport number, date of birth or phone.
- The QR code is `C1.<card ref>.<issued>.<expires>.<key id>.<signature>`:
  an opaque per-member reference, HMAC-SHA256 under a key derived from
  `JWT_SECRET`, valid 60 seconds with 15 seconds' grace for scanning.
- A scan checks the code, then the member's state at that moment, and
  answers `valid` (display name and member ID only), `expired` or
  `not_valid`, never why; every scan is audited with its reason.
  Suspending or inactivating also replaces the card reference, so codes
  already shown stop working (FR-CARD-015). The card shows the last
  successful scan, for C02's "Checked in".

Not built yet: wallet passes (INT-03, OD-06), the offline credential and
offline scanning (OD-08) and milestones. Event passes are their own codes
(see Events). The live PWA still uses Express's 10-minute card token,
which carries the member id, and shows it only for an official card.

## Notifications (BRD H03, P05, S14, GAP-05; FR-HOME-009 to 011, FR-REG-021, FR-ADM-007, FR-STF-009, FR-PROF-012)

- **Outbox.** A module adds a notice inside its own transaction, so the
  notice and the change it reports are saved together (AP-08): identity
  decisions and appeals (FR-REG-021), membership changes, event changes and
  cancellations, area-change, photo-removal and data-request outcomes.
  Wording comes from fixed bilingual templates whose titles name no person,
  number or case (FR-MSG-007, INT-02).
- **Inbox (H03).** All or Action needed, newest first, with topic chips and
  unread and action-needed counts. Each item names what it opens (BR-027);
  reading never clears Action needed, which ends when the task is done (a
  correction resubmitted, a removal request decided).
- **Choices (P05).** Push and SMS per topic; account and review notices
  cannot be turned off (refused, not ignored). Quiet hours (local time, may
  cross midnight) hold non-urgent pushes until they end (FR-STF-009).
- **Push.** Behind `app/integrations/push.py` (`PUSH_PROVIDER=none` or
  `development`; FCM and APNs credentials are not issued, INT-02). A push
  carries the short bilingual title and the notice's id only. Tokens move to
  whoever signs in on the device last; a token the service rejects is
  retired. Without a provider or a device, the inbox is the fallback
  (FR-MSG-008).
- **Broadcasts (GAP-05).** A `notifications.send` holder writes a bilingual
  announcement or emergency for an area inside their scope (another area is
  refused, BR-083), previews how many members it reaches, and schedules it.
  A text with an ID number is refused (BR-145). Wider than a district, a
  Tier 4 or 5 holder over the area who did not submit it approves first (an
  assumption on who approves). Emergencies are urgent and ignore quiet hours.
  While a silence window covers the area, an announcement is held (once
  recorded as `heldAt` and audited) and sent when the silence ends unless
  cancelled; emergencies still go, and their audit entry names the silence.
- **Dispatcher.** `python -m app.tasks.notifications` sends due broadcasts,
  alerts Tier 5 once about photo removal requests open 18 hours
  (FR-ADM-006), and pushes pending notices; a timer runs it every minute
  once the API is deployed. Row locks with SKIP LOCKED keep two runs from
  sending twice.

Not built yet: SMS and WhatsApp notices and STOP replies (INT-01, INT-14;
no vendors), staff alerts for new queue items, and the 24-hour event
reminder (now possible from the dispatcher).

## Profile and data-subject rights (BRD P01 to P06; FR-PROF-001 to 006, 009, 010, 014, 017 to 019)

- **Profile.** The member edits a display name and gender only; the legal
  name, date of birth and ID number come back as locked fields that need a
  new identity review (BR-073), and a display name never replaces the legal
  name (BR-074). The mobile number is shown masked and changes only through
  a code to the new number. The tier is shown as assigned. Verification is
  valid for a year after it was confirmed (OD-17, an assumption).
- **My Activity** lists every receipt the member holds, newest first, with a
  filter: identity reviews, appeals, events, photo removal requests, area
  changes and data-subject requests (FR-PROF-010).
- **Survey answers** can be seen, changed or deleted; deleting them is
  immediate and logged without the answers (FR-PROF-017). The identity-data
  notice gives the purpose and the proposed retention of each kind.
- **Area change.** A request to move to another GN division, with proof of
  residence kept encrypted in the evidence vault; the member's area stays as
  it is until an identity reviewer (`members.verify`, an assumption) over the
  requested area opens the proof and approves. One request at a time; a
  decision is final; nobody reviews their own (BR-076).
- **Password.** Only with the current one; wrong ones count like sign-in
  failures; the new password ends every session and the number is told
  (FR-PROF-014).
- **Data-subject requests.** A copy of one's personal data, or closing the
  account after the password and a one-time code: each has a DSR- receipt
  and a due date 21 working days on (Personal Data Protection Act,
  unverified, for the DPO to confirm). Closing promises no instant deletion
  and says what is kept and for how long (BR-079). The DPO register
  (`privacy.requests.handle`, a Tier 5 explicit grant, an assumption: the BRD
  names the DPO without a permission) runs soonest due first; completing a
  closure closes the account in both APIs; the member is told by SMS.

Not built yet: changing verified legal details through a new review
(FR-PROF-008), notification channel choices (FR-PROF-012, messaging),
volunteer-skill audience, assembling the copy of the data, anonymising a
closed account after 30 days, and the device-side settings (FR-PROF-011,
013, 015, 016).

## Home (BRD H01, H02, H04; FR-HOME-001 to 008, 012, 013)

`GET /v1/home` answers everything the Home tab shows, so the app never
guesses what a member may do (BR-089):

- **Layout.** `active` (H01) only when identity is Verified and membership
  Active; otherwise `awaiting_review` (H02) with the identity state and the
  VR reference for the status card (FR-HOME-001, 006).
- **One next step** (BR-025), in this order (an assumption): correct the
  identity documents, submit them, an event within 48 hours the member is
  going to, confirm a recovery number, complete the profile's area.
- **Coming up nearby:** the next event in the member's area with their
  response (FR-HOME-005).
- **Locks** (FR-HOME-007, 008; the policy is an assumption): reporting a
  local issue, My area, events, the card, the gallery, learning, local
  reports and area projects are open to everyone; volunteering, community
  participation, ideas, surveys, invites and the party fund wait for a
  Verified identity and an Active membership. Each lock gives the reason
  and the next step.
- **Quick actions** are Report issue, Volunteer, My area and Community
  (FR-HOME-004); the **hub** lists eight services under the member's GN,
  with the party fund after ideas, surveys and learning (FR-HOME-012, 013).

Not here: notifications (FR-HOME-009 to 011, notifications batch) and the
tabs themselves (FR-HOME-014, the apps).

## Gallery (BRD G01 to G03, GAP-04; FR-GAL-001 to 007, FR-ADM-005, 006)

- **Publishing.** Only `gallery.publish` holders add photos (BR-069), in
  albums in their own areas. Every upload (JPEG, PNG or WebP, up to 15 MB
  and 40 megapixels) is decoded and re-encoded as WebP in two sizes, so no
  EXIF, GPS or camera data survives; the original is not kept. Albums need
  a bilingual summary, both captions on every photo (a missing Tamil
  caption blocks submission) and, for an event album, a published event
  (BR-072). A different `gallery.publish` holder publishes a submitted
  album or returns it with a note (an assumption on who approves).
- **Members** see published albums (filters Events and Community, search by
  title or place), album detail with publisher and linked event, and the
  photos, with no download, share or tagging (BR-071). Photos are served
  only through the API to a signed-in member; staff also see their areas'
  unpublished albums.
- **Removal requests.** Every photo has one (BR-070): a member picks a
  reason and gets a receipt (RR- reference) due 24 hours later; asking again
  returns the same receipt. People who are not members use a public form
  with the album reference and the photo's number, three an hour per
  address (FR-GAL-007). The queue (`gallery.takedown` over the album's area)
  runs soonest due first and flags requests open 18 hours for Tier 5
  (alerting waits on notifications). A decision removes the photo and its
  files (answering every open request on it), blurs it, or keeps it, always
  with a reason, and cannot be changed; the requester is told by SMS when a
  number is known (FR-GAL-005).

Storage: `MEDIA_STORAGE_DIR`; without it the photo endpoints answer
`503 media_storage_not_configured`. The live app still shows Express's
sample albums.

## Events (BRD E01 to E06, GAP-03, S09; FR-EVT-001 to 017, FR-ADM-004, FR-STF-006)

Events live in their own schema (Alembic `0014`); the live app still uses
Express's `/api/events` until the member app moves over.

- **Listing (E01).** Members see every published event still to come, with
  their own response. "My area" (events scoped to an area the member is in)
  is the default and `scope=all` widens it (BR-057). Filters: an area, a
  date limit, type, the member's participation and a search of titles and
  venues. Cancelled events stay listed, marked cancelled; drafts never show.
- **RSVP (E05).** Going, maybe or declined, with no reason asked for
  declining; a change updates the one record and keeps every earlier
  response (BR-059). Going on a full event joins the waitlist, and the
  longest-waiting member takes a place that frees up (FR-EVT-011,
  assumption).
- **Pass (E06).** Only for a member going to an event that is on, and, by
  OD-12 (assumption), only with an Active membership unless the event admits
  pending members. Its QR is `E1.<pass ref>.<issued>.<expires>.<key id>.<signature>`
  under its own key: an opaque reference bound to one event and one member,
  valid 60 seconds (BR-060). The reference disappears when the member stops
  going or the event is cancelled.
- **Check-in.** Holders of `events.checkin_scan` over the event's area scan
  at that event: `checked_in`, `already_checked_in` (no second record,
  BR-061), `expired` (ask the member to refresh), `wrong_event`,
  `outside_window` or `not_valid`. Only a recorded attendance shows the
  name and member ID (BR-062); nobody checks themselves in. Attendance
  cannot be changed or deleted, and every scan is audited.
- **Manual check-in (FR-VOI-007).** When a pass cannot be scanned (camera
  refused or broken, no phone), the scanner types the member ID from the
  card and a reason. The same permission, window and eligibility apply as
  for a pass; the answer is `checked_in`, `already_checked_in`,
  `outside_window`, `not_eligible` (why stays in the audit log) or
  `not_valid`. The reason is kept on the attendance record and the roster
  shows each check-in as `scan` or `manual`.
- **Silence periods (NFR-ELC-03, FR-THL-008).** Publishing is refused with
  `silence_period` while a declared silence window covers the event's area,
  or when the event itself would take place inside one; so is moving a
  published event into one.
- **Console (GAP-03).** Holders of `events.manage` create drafts in their
  own areas, edit, publish and cancel (with a reason). Members going,
  maybe going or waitlisted are sent an SMS, after the response, when a
  published event is cancelled or its time or place changes. The check-in
  window defaults to an hour before the start until the end.
- **Roster (S09).** Expected (going) and attended counts with the list.

Not built yet: the 24-hour reminder (FR-EVT-018, scheduled tasks), notices
to members promoted from the waitlist or checked in, the volunteer link
(FR-EVT-008), My Activity and progress, the map and filter screens
(FR-EVT-004 to 006, the apps), event-scoped scanning grants for
volunteers (OD-12), and town halls and appointments.

## Feature flags (BRD FR-ARCH-011, D34, PRM-26)

Every v1.1 module sits behind a flag that stays off in production until its
phase gate is recorded (§20.2): a Tier 5 holder of `system.configure`
records the gate the module belongs to (`G1` for Phase 1, `G2` for Phase 2)
with the approval reference, then turns it on. A module that is off answers
`404 feature_unavailable` on every route, so no screen can half-work.
Turning a module off works at any time. Each change keeps its reason in
`ops.feature_flag_change` (append-only) and is audited with codes only.
`GET /v1/features` tells the apps which modules to show.

Production always enforces the flags; elsewhere they are enforced only with
`ENFORCE_FEATURE_FLAGS=true`, so development and tests see every module.
Gated today: identity appeals and duplicate investigations (G1) and what
members see of elections (`election_mode`, G2). Modules from the Express
era (sign-in, registration, events, the card) are not v1.1 modules and are
not gated.

## Election periods and silence (BRD D22, NFR-ELC-01, 03, 05, 06, 08; FR-ELX-001, 004, 008, 010)

- **Periods (D22).** A Tier 5 holder of `election.mode.manage` declares a
  period for an election type and an area from an Election Commission
  publication (link, reference, publication time), with its own silence
  window. The window must lie inside the period and cover the whole
  polling day (Sri Lankan date), which is how polling-day suspension
  (NFR-ELC-08) applies. Several periods may run at once (NFR-ELC-05); one
  that overlaps another in time and area is accepted with a warning. A
  period is ended when the election is over, or withdrawn if declared in
  error, with a reason.
- **Silence (NFR-ELC-03, FR-ELX-008).** While a window covers an area,
  events and gallery albums there cannot be published (`409
  silence_period`, audited as `election.silence.blocked`), no event may be
  scheduled inside a window, and announcement broadcasts reaching the area
  are held (`election.silence.held`, once) until it ends. A window covers a
  place when either area contains the other, so a platform-wide broadcast
  is held by a district's silence. [ASSUMPTION] until POL-12: every
  announcement, event and album counts as campaign content; emergencies
  and notices to one member about their own case still go.
- **Members (FR-ELX-001, 004).** `GET /v1/election/current` lists the
  periods whose area contains the member's, with the polling day, a
  countdown in Sri Lankan days, the source and its publication time, and
  the notices published for it. Each notice carries exactly one label,
  Election Commission information or Party information; Election
  Commission information must name its link, document reference and
  publication time, and is withdrawn when superseded (NFR-ELC-06). This
  endpoint is the `election_mode` feature.
- **No vote data (FR-ELX-010).** No field records how anyone votes or
  intends to vote; a test checks every field and path in the OpenAPI
  document.

Not built yet: the duty roster (FR-ELX-005 to 007), polling information and
the voter-registration link (FR-ELX-002, 003), the election-period report
(FR-ELX-009), tagging contributions (NFR-ELC-04, with finance), and the
change freeze and monitoring (NFR-ELC-02, an operating procedure).

## Identity evidence (BRD FR-ARCH-007, BR-086)

Members upload NIC front and back, passport-page and selfie images. Each
upload is a new version; the previous one is kept, marked superseded. Images
are JPEG, PNG or HEIC up to 10 MB, recognised from their bytes rather than
from what the client claims. Since every version is kept, a member may upload
12 images in 24 hours (an assumption); more answer `429 upload_limit` with
`Retry-After`, before anything is written.

- **Storage.** Each image is encrypted with AES-256-GCM under
  `EVIDENCE_ENCRYPTION_KEY`, bound to its document id, before it is written
  to `EVIDENCE_STORAGE_DIR`. The database keeps only the record
  (`identity.identity_document`), never the image.
- **Viewing.** A reviewer asks for a view link to one image. The API checks
  `members.view_identity_evidence` over the member's area and refuses the
  reviewer's own record (BR-085). The link names that image and that
  reviewer and expires after 5 minutes. Using it also needs the reviewer's
  own session, and the permission is checked again, so a revocation stops
  links already issued.
- **Logging.** Issuing a link, every view and every refusal are written to
  the audit log. Members see the date of each view and "Identity reviewer",
  never who it was (FR-AUTH-024).
- **No member download** (BR-021): members see which images the server
  holds, not the images.

- **Only inside an open review** (PRM-03): a reviewer opens a member's
  images only while they hold that member's identity review in review.

Not yet: relatives (BR-085) are not recorded; nothing is deleted until the
retention period is decided (OD-03). Without the two settings the endpoints
answer `503 evidence_storage_not_configured`.

## Identity verification (BRD W01, W02, §9.3)

A member uploads the images of one route (NIC: front, back and selfie;
passport: photo page and selfie) and submits them with a declaration
(BR-011). That creates a review with a `VR-` reference in state `submitted`;
submitting again while it is open returns the same review.

1. **Queue (W01).** Holders of `members.verify` see the reviews in their
   areas, oldest waiting first, with counts for awaiting review, needs update
   and assigned to me. The area is the member's area when they submitted.
2. **Claim.** A reviewer claims a review (`in_review`), so nobody else
   decides it; others see who holds it. Claiming opens the member's evidence
   to that reviewer. A claim held by someone who has since lost
   `members.verify` there can be taken over. Nobody claims their own record.
3. **Decision (W02).** The claimant chooses one of three, each stored
   immutably with the reviewer, their tier, the time and the document
   versions (FR-WEB-011, BR-082):
   - *Approve identity* needs the whole checklist and every required image
     opened by this reviewer in its current version.
   - *Request an update* names the items and a reason category; the member
     replaces only those, and the correction returns to the same review and
     reviewer (FR-REG-022, 023).
   - *Unable to verify* needs a reason category; the member can submit again.
4. **Status.** Approval confirms identity only; membership stays a separate
   decision (BR-014, OD-02). `npm.member.verification_status` is kept in step
   (`review_pending`, `identity_confirmed`) for the live member app and the
   Express API.

The reason categories are proposed, not from the BRD, and need sponsor
confirmation. Not built yet: automated screening (D03), duplicate flags
(FR-WEB-012), notifications to the member (FR-REG-021) and consent records
(BR-008).

### Appeals (FR-IDV-013, PRM-29, M04, D05)

A member may appeal a *Request an update* or *Unable to verify* decision
once, in up to 1,000 characters, and gets a `VA-` reference. Until the appeal
is decided they cannot submit again.

Holders of `idv.appeal.decide` (Tier 4 or 5) over the member's area see the
appeals queue. One person claims an appeal; while they hold it, the member's
evidence opens to them. The reviewer who made the decision under appeal can
never claim it, and nobody decides their own appeal.

- *Uphold*: the decision stands; the member sees the outcome and the reason.
- *Overturn*: the review goes back to the queue for a fresh decision by
  anyone except the original reviewer. The appeal decider does not approve
  identity themselves: approval still needs `members.verify`, the checklist
  and the evidence (BR-012). This reading of "overturn" needs sponsor
  confirmation.

A decided appeal cannot be changed or deleted (database trigger). The
10-working-day target is not tracked yet.

### Duplicate accounts (FR-IDV-010, FR-WEB-012, BR-094, D04)

NIC hashes and phone numbers are already unique among active members, so
the same NIC or phone cannot be registered twice (BR-007, enforced at
sign-up). Other signs that one person holds two accounts open an
investigation instead of any automatic action:

- When a review is submitted, any other active account with the same name
  (ignoring case and spacing) and date of birth opens a case. This signal is
  an assumption; the BRD names keyed hashes, contact details and approved
  face similarity.
- A reviewer can report a suspected duplicate with a reason, from inside the
  member's identity review they hold (PRM-03). Whoever reported a case never
  claims it (`409 reported_by_you`), so a report cannot open a second
  member's evidence.

The reviewer sees each case as a flag on the review file. A holder of
`idv.duplicate.investigate` over both accounts' areas claims the case, can
open both accounts' evidence while holding it, and records "not a
duplicate" or "duplicate confirmed" with a reason. The finding changes
neither account; inactivating one is a separate membership change. Decided
cases cannot be edited.

Not yet: passport numbers and device signals (registration batch), and
keyed-hash rotation with KMS-held keys (FR-IDV-006, OD-20).

## Community finance (BRD H17, H18, D10; FR-FIN-001 to 010, BR-095 to 097)

Community finance provides bank-transfer slip intake for member contributions
and an operational review queue and ledger for staff (Milestone 1.4).

- **Intake & gating.** Member routes (`/v1/fund/*`) require the `community_finance`
  feature flag and an enabled, fully configured bank account profile; otherwise they fail
  closed (`503 finance_not_configured`).
- **Encrypted evidence vault.** Bank transfer slips are inspected for MIME magic bytes (JPEG/PNG only),
  size (15 MB max), image dimension / decompression bomb safety (max 40 MP), stripped of EXIF metadata,
  scanned by ClamAV outside development, and stored encrypted at rest using AES-256-GCM authenticated encryption.
- **Workflow & separation of duties (RB-12).**
  - Members draft a contribution, upload slip evidence, acknowledge required declarations, and submit (`SUBMITTED`).
  - Reviewers (`finance.review`) claim records into `PENDING_REVIEW` and reconcile against bank statement references (`APPROVAL_PENDING` or `NEEDS_CORRECTION`).
  - Approvers (`finance.approve`) independently approve (`VERIFIED`) or reject (`REJECTED`). The approver must be
    a different staff member from the reviewer and cannot be the contributing member.
  - On independent approval, an immutable sequential receipt code (`CN-XXXXX`) is atomically assigned.
- **Ledger export.** Staff with `finance.export` can export monthly reconciliation ledgers as CSV
  with formula-injection protection (`=`, `+`, `-`, `@` escaped).

## Sessions

Members can sign in through either API (`/api/auth/login` or
`/v1/auth/sign-in`). Both set the same HttpOnly, SameSite=Lax `mp_session`
cookie (Secure outside development), and both accept that cookie or the same
token in an `Authorization: Bearer` header. Both use the same `JWT_SECRET` and
`NIC_PEPPER`, so a session from either works in both:

- the token is an HS256 JWT `{sub: member id, sv: session version}`, valid for 30 days;
- signing out through either API increments `npm.member.session_version`, and
  both then refuse every older token (`401 session_expired`);
- deleted members are refused (`401 unauthorized`).

Sign-in throttling follows `server/src/throttle.js`, and both APIs count the
same `npm.auth_attempt` rows. Failures are counted per NIC hash and client IP
together over 15 minutes: from 5 failures each attempt waits 0.4 s more (up to
2 s), from 10 attempts are refused for 15 minutes with `Retry-After: 900`. A
correct password clears the failures. Each attempt is counted as a failure
before its password is checked, under a database lock both APIs take for the
same number and address, so attempts made at the same moment cannot slip
past the limit together. The wait is asynchronous, so throttled
attempts do not tie up the server.

Two deliberate differences from the Express API:

- An unknown NIC still runs a bcrypt check, so the response time does not
  reveal which NICs are registered.
- The client IP is not read from `X-Forwarded-For` directly, because a client
  can forge it and get unlimited attempts. **Behind Nginx, start uvicorn with
  `--proxy-headers --forwarded-allow-ips=127.0.0.1`** (Nginx's address), so the
  real client address is used. Without that, every request appears to come
  from Nginx, and ten wrong passwords for one NIC would lock that member out
  for everyone.

Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests from another site
are refused with `403 csrf_origin_mismatch`, as in the Express API. Requests
without the cookie (mobile apps) or without an `Origin` header are not
affected; `ALLOWED_ORIGINS` adds trusted origins. Every `/v1` response carries
`Cache-Control: no-store` and the Express API's security headers.

### Compatibility with the Express API

`tests/test_security.py` checks the Python code against fixed vectors that
`server/src/lib.js` produced (`tests/express/auth_vectors.json`).
`tests/test_express_compat.py` runs `lib.js`, `throttle.js` and bcryptjs live:
tokens and password hashes in both directions, and the throttle decision for 0
to 11 failures against the same database rows. It needs Node and
`npm ci --prefix server`, and is skipped otherwise. Regenerate the vectors
after any change to `lib.js`:

```powershell
node tests/express/auth_helpers.mjs --write-vectors
```

Passwords: bcryptjs uses only the first 72 bytes of a password, so the Python
code cuts passwords at 72 bytes too (a Tamil character is 3 bytes).

## Run locally (Windows PowerShell)

```powershell
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
copy .env.example .env    # then set DATABASE_URL to your local database
uvicorn app.main:create_app --factory --reload --port 8000
```

Open http://localhost:8000/v1/health and http://localhost:8000/v1/health/db.
Interactive docs are at http://localhost:8000/docs outside production.

## Test

```powershell
python -m pytest
```

Tests in `tests/test_database.py` and `tests/test_members_me.py` use the
`DATABASE_URL` from `.env` or the environment and are skipped when none is
set. The member tests write inside a transaction that is always rolled back.
CI runs everything against a fresh PostgreSQL container.

## Database migrations (Alembic)

Before Alembic, the Express API built the schema with `server/migrations/*.sql`.
Alembic revision `0001` is a baseline that stands for all twelve of those files
and changes nothing. Alembic refuses to run (even `stamp`) on a database where
any of them is missing, so a database that is behind is never marked current.

| Database | Commands |
|---|---|
| Existing, with all Express migrations applied, not yet under Alembic | `python -m alembic stamp 0001`, then `python -m alembic upgrade head` |
| Existing, behind on Express migrations | `npm run migrate --prefix ../../server`, then `python -m alembic stamp 0001` and `python -m alembic upgrade head` |
| Already under Alembic | `python -m alembic upgrade head` |
| New and empty | `npm run migrate --prefix ../../server`, then `python -m alembic upgrade head` |

Check the state with `python -m alembic current`. From now on, every schema
change is a new Alembic revision, never a new file in `server/migrations`:

```powershell
python -m alembic revision --rev-id 0012 -m "describe the change"
python -m alembic upgrade head --sql    # review the SQL before applying it
python -m alembic upgrade head
```

Autogenerate (`--autogenerate`) only compares tables declared on
`app.db.base.Base`. Tables created by the Express migrations are ignored, so it
never proposes dropping them.

## Settings

Settings are read from environment variables, falling back to `services/api/.env`.
`.env.example` lists every name; the real `.env` is never committed.

| Variable | Values | Effect |
|---|---|---|
| `APP_ENV` | `development` (default), `staging`, `production` | `production` hides `/docs` and `/openapi.json` |
| `DATABASE_URL` | PostgreSQL URL (required) | The same value the Express API uses; `postgres://` and `postgresql://` both work |
| `JWT_SECRET` | long random string (required) | Must equal the Express API's `JWT_SECRET`; production refuses the `dev-secret` fallback |
| `STAFF_MFA_REQUIRED` | `true` (default), `false` | Staff give an authenticator code in each session; only development may switch it off |
| `SMS_PROVIDER` | `none` (default), `development`, `notify_lk` | How one-time codes are sent; `development` keeps them in memory and is refused outside development; `notify_lk` sends through Notify.lk |
| `NOTIFY_LK_USER_ID`, `NOTIFY_LK_API_KEY`, `NOTIFY_LK_SENDER_ID` | the Notify.lk account (API key is a secret) | Needed with `SMS_PROVIDER=notify_lk`; `NotifyDEMO` is refused in production |
| `PASSPORT_NUMBER_PATTERN` | regular expression (optional) | Passport numbers accepted at registration; default 6 to 9 letters or digits |
| `NIC_PEPPER` | string (required) | Must equal the Express API's `NIC_PEPPER`, and never change; production refuses `dev-pepper` |
| `ALLOWED_ORIGINS` | comma-separated origins (optional) | Other sites allowed to send cookie-authenticated writes |
| `EVIDENCE_STORAGE_DIR` | private directory (optional) | Where encrypted identity images are kept; production uses the encrypted `/srv/secure` volume |
| `EVIDENCE_ENCRYPTION_KEY` | 32 bytes, base64 (optional, with the directory) | Encrypts every identity image; keep a copy apart from the files |
| `MEDIA_STORAGE_DIR` | directory (optional) | Where gallery photos are kept as WebP files; back it up with the database |
| `PUSH_PROVIDER` | `none` (default), `development` | How notices are pushed; `development` keeps pushes in memory and is refused outside development |
| `ENFORCE_FEATURE_FLAGS` | `false` (default), `true` | Keep v1.1 modules off until their gate is recorded and they are turned on; always on in production |

## Layout

```text
app/
  main.py              builds the FastAPI app (create_app)
  health.py            /v1/health and /v1/health/db
  core/config.py       environment settings
  core/security.py     NIC hash, bcrypt, session tokens (shared with Express)
  core/middleware.py   cross-origin write check and security headers
  db/session.py        engine and per-request sessions (get_db)
  db/base.py           ORM base class and the autogenerate table filter
  db/express_baseline.py   the Express migrations behind revision 0001
  modules/auth/        sign-in, sign-out, throttle, sessions, authenticator codes, CurrentMember dependency
  core/sealing.py      AES-256-GCM sealing shared by the evidence vault and MFA secrets
  modules/membership/  /v1/members/me and membership states: rules, service, router, schemas, repository
  modules/membership/card/  the member card, QR codes and scanning
  modules/access/      staff tiers, permissions, areas, assignments, quarterly reviews, bootstrap command
  modules/audit/       append-only, hash-chained audit log
  core/permissions.py  staff tiers and the BRD permission matrix
  modules/identity/documents/  identity images: encrypted vault, upload, signed view links
  modules/identity/reviews/    identity reviews: submit, queue, claim, decide
  modules/identity/appeals/    appeals against identity decisions
  modules/identity/duplicates/ duplicate account investigations
  modules/identity/registration/ sign-up, consent, registration progress
  modules/identity/recovery/  recovery number, one-time codes, recovery, assisted recovery
  integrations/sms.py   the SMS interface (no vendor yet)
  modules/geography/  district, DS and GN lists
  modules/events/     events, RSVPs, event passes, check-in and the roster
  modules/home/       the Home tab: layout, next step, locks, hub
  modules/profile/    the member's profile, My Activity, survey answers; area_changes/ GN moves
  modules/privacy/    data-subject requests and the DPO register
  modules/messaging/notifications/  the inbox, choices, devices and push delivery
  modules/messaging/broadcasts/     staff broadcasts by area
  integrations/push.py  the push interface (no provider yet)
  tasks/notifications.py  the dispatcher, run every minute
  modules/content/gallery/  albums, photos (re-encoded WebP), removal requests
  modules/features/   feature flags for v1.1 modules and require_feature()
  modules/election/   election periods, silence windows, notices, the member banner
  core/rotating_codes.py  60-second signed QR codes (member card, event pass)
  modules/<households, assistance, community, events, engagement, finance, content, messaging, ai>/
                       README only: not built yet
  integrations/, tasks/  README only: not built yet
Dockerfile             production-style image (python:3.12-slim, unprivileged user)
alembic/               Alembic environment and revisions
tests/                 pytest tests
tests/express/         Node helper and vectors from server/src/lib.js
```

Each feature module under `app/modules/<name>/` keeps the router thin, puts
rules in `service.py` and SQL in `repository.py`. Tables still owned by the
Express migrations are queried with SQL rather than declared as models, so
Alembic autogenerate leaves them alone.
