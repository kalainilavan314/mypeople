# Security rules

The rules every change must follow, and what is in place today. BRD references: §9.5 (RB-01 to RB-07), §11.18 (FR-ARCH), §11.42 (FR-AUTH-018 to 027), §14 (NFR-SEC, NFR-PRV), §16.9 (explicit prohibitions).

## Rules

1. **The server decides.** Every permission, scope and purpose check runs in the API. Hiding a button is never the only safeguard (RB-01).
2. **Purpose separation.** Identity, membership, household, assistance and finance data stay apart, with no cross-purpose joins (AP-02).
3. **Identity evidence is private.** NIC and passport images, selfies and biometric data live only in private storage, are served through short-lived signed links after a permission check, and are never cached offline or put in a QR code.
4. **AI only advises.** Automated identity checks never approve anyone; an authorised person decides, and can be audited.
5. **Help is never political.** Humanitarian assistance never depends on membership, donations or political support.
6. **No political profiling.** No voter-preference inference, persuasion scoring or profiling from family, household, assistance, health or location data.
7. **Location is optional** and asked for only when a specific feature needs it.
8. **Privileged staff use MFA**; every staff grant names a person, permission, geographic scope, grantor and time (RB-02); nobody decides their own case (RB-04).
9. **Everything sensitive is logged** in an append-only audit trail, with documented retention (OD-03).
10. **No secrets in the repository.** Real values live in untracked `.env` files and on the server. Production refuses the `dev-secret` and `dev-pepper` fallbacks.
11. **People load their own keys.** Never ask for, accept, store or use an SSH passphrase or private key; the developer loads deploy keys into an SSH agent.

## In place today

| Area | Control |
|---|---|
| Sessions | HttpOnly, SameSite=Lax `mp_session` cookie (Secure in production); HS256 JWT `{sub, sv}`, 30 days, only HS256 accepted |
| Sign-out | Increments `session_version`, ending every session of the member in both APIs; only a token that still works can do it, so an old copy cannot keep signing the member out |
| Sessions (FastAPI) | Each session is a row the token names: listed with a coarse device label, ended one by one or all others, refused on its next request by both APIs (Express checks the row for any token that names one, and refuses if it cannot), expired after 30 days unused; a new device is announced on the confirmed number |
| Staff MFA (FastAPI) | Authenticator codes (TOTP) required in each session before any staff endpoint; one use per code, checked under a row lock so two requests cannot both use it; wrong codes counted per authenticator across every session: five lock it for 15 minutes, then 1 hour, 4 hours and 24 hours in a row until a right code, with no code checked while locked; each failure and lockout audited and the confirmed number told of a lockout; five wrong codes in one session also end it; secrets encrypted at rest; Express tokens never act as staff |
| Passwords | bcrypt cost 10; the first 72 bytes count (as bcryptjs) |
| NIC and passport | Stored only as SHA-256 of `NIC_PEPPER` + the normalised number (passports prefixed with their country); one unique index stops a second account for the same number |
| Registration (FastAPI) | Passwords of at least 10 characters, not common, not containing the ID number; terms consent recorded with the notice version; identity-review consent required before any upload (BR-008); referrals never change anyone's tier (SG-03) |
| Sign-in throttling | Per NIC hash and client IP: delay from 5 failures, 15-minute lockout from 10; shared by both APIs; each attempt counts as a failure before its password is checked, under a database lock both APIs take, so simultaneous attempts cannot pass the limit together |
| Client IP | Express trusts only the local proxy (`trust proxy` = loopback, `req.ip`); Nginx sets `X-Forwarded-For $remote_addr`; FastAPI must run uvicorn with `--proxy-headers --forwarded-allow-ips=127.0.0.1` behind Nginx |
| Timing | FastAPI runs bcrypt even for unknown NICs, so response time does not reveal registered NICs |
| CSRF | Cookie-authenticated writes from another origin get `403 csrf_origin_mismatch` (both APIs) |
| CORS | FastAPI: only `ALLOWED_ORIGINS` (with cookies); in development also `http://localhost` ports. Production allows no other origin |
| Mobile config | Only the public API address goes in `EXPO_PUBLIC_*` variables, which are readable inside the app |
| Headers | `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`; API responses `Cache-Control: no-store` |
| OTP | Stored as HMACs; per-phone limits per purpose and per-IP limits for any purpose; burned after 5 wrong guesses; the same table and rules in both APIs; Express's public endpoints accept only its own purposes, so they cannot cancel or burn the new API's codes; recovery SMS are sent after the answer |
| Recovery (FastAPI) | Codes only to a number the member confirmed by code; asking to confirm a number answers the same whether or not another account has it (the clash shows only after a correct code); the same answer whether or not an ID number is registered; a reset token valid 10 minutes and single-use; a new password ends every session and the contact is told; a changed number tells the old one; assisted recovery handled by reviewers in the member's area, and a staff account's number replaced only by a higher tier |
| Card QR | Express: an opaque, signed, 10-minute token, never NIC or date of birth. FastAPI: an opaque per-member reference, HMAC-SHA256, 60 seconds; scans check the live state, reveal only name and member ID, and are audited; suspension replaces the reference |
| Avatars and slips | Served through signed, expiring URLs or admin-only routes |
| Errors | 5xx details go to a private `error_log` table, never to the response |
| Staff permissions (FastAPI) | Tier + explicit permissions + area per assignment (BRD §9); checked on the server for every request; refusals logged; revocations apply on the next request; an assignment whose 12-month review is overdue stops counting |
| Granting (RB-02, RB-03, BR-083, BR-097) | Only holders of `roles.assign`, inside their own area, for tiers below their own; no self-assignment; the person's identity must be confirmed and their membership Active (BR-097), and their rights stop while their membership is suspended or inactive; preview before saving |
| Separation of duties (RB-12) | Assistance decisions are refused alongside fundraising or election-roster rights in an overlapping area |
| Identity evidence (FastAPI) | Images encrypted with AES-256-GCM, each bound to its document id, in a private directory; the database holds records only. Reviewers need `members.view_identity_evidence` over the member's area and must hold the member's identity review in review (PRM-03), never for their own record; each image opens through a link for one reviewer that expires after 5 minutes and still needs their session; the permission is checked again on every view. Links, views and refusals are audited; members see when (not who). No member download; uploads must be real JPEG, PNG or HEIC, at most 10 MB, and at most 12 a day per member |
| Identity decisions (FastAPI) | Only holders of `members.verify` over the member's area, one claimed review at a time, never their own record; no bulk decisions; approval needs the full checklist and every required image opened by the deciding reviewer; each decision is stored with reviewer, tier, time and document versions, and the database refuses to change or delete it. Approval confirms identity only, never membership or staff rights |
| Identity appeals (FastAPI) | One appeal per adverse decision; decided only by holders of `idv.appeal.decide` over the member's area, never the original reviewer or the member; evidence opens only to the person holding the appeal; the outcome and reason are final (database trigger); an overturned decision is re-decided by someone other than the original reviewer |
| Duplicate accounts (FastAPI) | NIC hashes and phone numbers unique among active members; other signals open an investigation, decided by a holder of `idv.duplicate.investigate` over both accounts, never one of them; a reviewer reports a suspected duplicate only from the member's review they hold (PRM-03) and never investigates their own report; the finding never changes an account by itself (BR-094) and cannot be edited |
| Events (FastAPI) | Event passes are 60-second codes under their own key, carrying an opaque reference bound to one event and one member that disappears when the member stops going or the event is cancelled; scans need `events.checkin_scan` over the event's area, record attendance once, show a name only for a recorded attendance, never for one's own pass, and are audited; attendance and RSVP history are append-only; event managers act only in their own areas |
| Membership (FastAPI) | Activation, suspension, reinstatement and inactivation only by holders of `members.activate` over the member's area, never on their own record, always with a reason; a staff member's membership only by someone whose tier ranks above all of theirs; history is append-only (database trigger) |
| Audit log | `ops.audit_log`: append-only (database triggers) and hash-chained; regional auditors see only their region; grants, revocations and refused access are recorded with ids only; repeated refusals by one person for one permission and reason are written once per 10 minutes and counted in between (`ops.denial_tally`) |
| Network | Firewall allows only 22, 80, 443; PostgreSQL listens on localhost |
| Backups | Encrypted, off-server restic backups daily and before each release, integrity-checked |
| Dependencies | `npm audit` clean for the Express API (October 2026) |

## Not yet in place

| Gap | Planned in |
|---|---|
| Express still decides its four staff routes by `is_admin`. The first Super Administrator is created with `python -m app.modules.access.bootstrap` | When identity verification and finance move to `/v1` |
| How RB-03 is applied (see `app/modules/access/rules.py`) needs sponsor confirmation, as does the RB-12 list of conflicting rights (OD-32) | Sponsor |
| Automatic membership activation on identity approval (OD-02) and the migration of existing members at go-live | OD-02 |
| Notifying the person on grant or revocation; the quarterly access-review workflow (FR-AUTH-027) | Messaging and admin dashboard |
| Passkeys, step-up codes for new devices, refresh-token rotation, alerts to the old device | Later account-security work; push notifications |
| The identity vault in its own database and storage account with separate credentials and managed keys (INT-08, §13.8); a key-rotation tool. Today: own schema, encrypted files on `/srv/secure`, one key in the API's settings | Hosting decision (OD-20) |
| Relatives of a reviewer (BR-085); the reviewer screen's watermark (FR-WEB-006) | Relatives register, reviewer screen |
| Express `POST /api/members/:id/verification` (`is_admin`) can still set a verification status without a review | Switch it off when `/v1` verification goes live |
| Consent records before upload (BR-008), the 10-working-day appeal target, passport and device duplicate signals, KMS-held keyed hashes (FR-IDV-006) | Registration batch, hosting decision (OD-20) |
| Selfies taken only with the live camera (FR-REG-014) is enforced by the app, not the API | Member app |
| Retention periods for ID images, selfies and decisions | Waiting on OD-03 |
| Express listens on all interfaces (`*:3001`); the firewall blocks it, binding to `127.0.0.1` would add a layer | Next deploy |
| CI security scans (SAST, dependency, secret scanning) | CI batch |
| No SMS vendor: production cannot send one-time codes, so recovery answers 503 until INT-01 is contracted | INT-01 vendor |
| Registration and assisted-recovery limits are per address only (5 and 3 an hour); the Express sign-up accepts 6-character passwords and promotes tiers by referral count, which SG-03 forbids | Sessions batch; retire the Express sign-up |
| `npm audit`: 5 high findings in Expo's development CLI (`@expo/cli` via `node-forge`, `zod`), not in app bundles; npm's only fix is a downgrade | Next Expo patch release |
| Replacing the `karan-server-admin` SSH key, exposed in a chat on 24 October 2026 | Server owner |

## Review findings from 25 October 2026

An independent review of `services/api` after Batch 15 confirmed these. All were fixed and retested on 25 October 2026: the high and medium items in Batch 15b (Alembic `0012`, Express `src/sessions.js`), the low items in Batch 15c (Alembic `0013`, Express `src/throttle.js` and `index.js`). The Express changes reach production with the next release.

| Severity | Finding | Status |
|---|---|---|
| High | Staff authenticator codes could be guessed across many sessions: wrong codes were counted per session, and a new sign-in started again | Fixed: counted per authenticator, escalating lockouts, audited, the staff member told |
| Medium | Ending one session was not honoured by Express, which accepted the same cookie | Fixed: Express refuses a token whose session is ended, idle or missing |
| Medium | `POST /v1/identity/me/phone` revealed whether a number belongs to any account, without a limit | Fixed: rate limits first, the same answer for every number, the clash only after a correct code |
| Medium | A duplicate report let its reporter open two members' evidence without an open review | Fixed: reports only from the member's review the reporter holds; the reporter cannot claim the case |
| Medium | Lower-tier staff could suspend higher-tier staff and replace their recovery number through assisted recovery | Fixed: refused when the person holds a tier at or above the actor's (`target_outranks_you`) |
| Low | A TOTP code could be used twice by concurrent requests | Fixed with the high item: codes are checked under a row lock |
| Low | Concurrent sign-in failures could pass the lockout | Fixed in both APIs: counted before the password check, under a shared lock |
| Low | Refused staff requests could flood the audit log | Fixed: once per person, permission and reason in 10 minutes, repeats counted |
| Low | No upload quota | Fixed: 12 images a day per member, checked before anything is written |
| Low | Sign-out accepted revoked tokens | Fixed in both APIs: only a working session signs the member out |
| Low | Express could burn or cancel recovery codes, and used up shared per-phone limits | Fixed: Express accepts only its own purposes; per-phone limits per purpose in both APIs |
| Low | Recovery timing would reveal registered numbers once SMS is live | Fixed: the code is stored in the request and sent after the answer |

Consequences to know: a locked authenticator cannot be unlocked by staff yet, only waited out; nobody outranks the Super Administrator, so that account's membership and recovery number cannot be changed through the API (no procedure exists yet); the lockout and upload figures are assumptions for sponsor confirmation; a refusal tally's last window is reported only when that person is refused again (the tally table holds the count meanwhile).

## Reporting a security problem

Do not open a public issue. Tell the project owner directly, with the steps to reproduce.
