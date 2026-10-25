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
| `POST /v1/events/{id}/scan`, `GET /v1/events/{id}/attendance` | check-in and the attendance roster; need `events.checkin_scan` over the event's area (the roster also opens with `events.manage`) |
| `GET`/`POST /v1/identity/me/phone`, `POST /v1/identity/me/phone/confirm` | the recovery number, confirmed by a one-time code |
| `POST /v1/auth/recovery/request`, `/verify`, `/reset`, `/assisted` | account recovery by code, a new password, and assisted recovery requests |
| `GET /v1/identity/recovery-requests`, `POST .../{id}/resolve` | the assisted-recovery queue; needs `members.verify` over the member's area |
| `POST /v1/auth/sign-out` | ends every session of the member (`204`) and clears the cookie; an old or ended token only clears the cookie |
| `GET /v1/auth/sessions`, `POST /v1/auth/sessions/{id}/revoke`, `POST /v1/auth/sessions/revoke-others` | the member's signed-in devices; end one or all others |
| `GET /v1/auth/mfa`, `POST /v1/auth/mfa/totp`, `.../totp/confirm`, `POST /v1/auth/mfa/verify` | the staff second factor: enrol an authenticator app, give its code in each session |
| `GET /v1/access/me` | the caller's staff assignments that count now |
| `GET /v1/access/catalogue`, `POST /v1/access/assignments/preview`, `POST /v1/access/assignments`, `POST /v1/access/assignments/{id}/revoke` | staff assignments (W09); need `roles.assign` |
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
assigned through `/v1/access/assignments`. The Express API still reads its
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

## Sessions and the staff second factor (FR-AUTH-019 to 021, 025, NFR-SEC-04)

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

Not built yet: step-up codes for new devices (FR-AUTH-022), alerts to the
old device (needs push), refresh-token rotation (FR-AUTH-025), passkeys,
and the quarterly access review (FR-AUTH-027).

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
- **SMS.** `app/integrations/sms.py` sends through an interface. No vendor is
  chosen (INT-01), so `SMS_PROVIDER=none` answers `503 sms_not_configured`;
  `SMS_PROVIDER=development` keeps messages in memory and returns the code
  in the response, and is refused outside development.
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
| `SMS_PROVIDER` | `none` (default), `development` | How one-time codes are sent; `development` keeps them in memory and is refused outside development |
| `PASSPORT_NUMBER_PATTERN` | regular expression (optional) | Passport numbers accepted at registration; default 6 to 9 letters or digits |
| `NIC_PEPPER` | string (required) | Must equal the Express API's `NIC_PEPPER`, and never change; production refuses `dev-pepper` |
| `ALLOWED_ORIGINS` | comma-separated origins (optional) | Other sites allowed to send cookie-authenticated writes |
| `EVIDENCE_STORAGE_DIR` | private directory (optional) | Where encrypted identity images are kept; production uses the encrypted `/srv/secure` volume |
| `EVIDENCE_ENCRYPTION_KEY` | 32 bytes, base64 (optional, with the directory) | Encrypts every identity image; keep a copy apart from the files |

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
  modules/access/      staff tiers, permissions, areas, assignments, bootstrap command
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
