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
| Sign-out | Increments `session_version`, ending every session of the member in both APIs |
| Passwords | bcrypt cost 10; the first 72 bytes count (as bcryptjs) |
| NIC and passport | Stored only as SHA-256 of `NIC_PEPPER` + the normalised number (passports prefixed with their country); one unique index stops a second account for the same number |
| Registration (FastAPI) | Passwords of at least 10 characters, not common, not containing the ID number; terms consent recorded with the notice version; identity-review consent required before any upload (BR-008); referrals never change anyone's tier (SG-03) |
| Sign-in throttling | Per NIC hash and client IP: delay from 5 failures, 15-minute lockout from 10; shared by both APIs |
| Client IP | Express trusts only the local proxy (`trust proxy` = loopback, `req.ip`); Nginx sets `X-Forwarded-For $remote_addr`; FastAPI must run uvicorn with `--proxy-headers --forwarded-allow-ips=127.0.0.1` behind Nginx |
| Timing | FastAPI runs bcrypt even for unknown NICs, so response time does not reveal registered NICs |
| CSRF | Cookie-authenticated writes from another origin get `403 csrf_origin_mismatch` (both APIs) |
| CORS | FastAPI: only `ALLOWED_ORIGINS` (with cookies); in development also `http://localhost` ports. Production allows no other origin |
| Mobile config | Only the public API address goes in `EXPO_PUBLIC_*` variables, which are readable inside the app |
| Headers | `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`; API responses `Cache-Control: no-store` |
| OTP | Stored as HMACs; per-phone and per-IP limits; burned after 5 wrong guesses |
| Card QR | Carries an opaque, signed, 10-minute token, never NIC or date of birth |
| Avatars and slips | Served through signed, expiring URLs or admin-only routes |
| Errors | 5xx details go to a private `error_log` table, never to the response |
| Staff permissions (FastAPI) | Tier + explicit permissions + area per assignment (BRD §9); checked on the server for every request; refusals logged; revocations apply on the next request; an assignment whose 12-month review is overdue stops counting |
| Granting (RB-02, RB-03, BR-083, BR-097) | Only holders of `roles.assign`, inside their own area, for tiers below their own; no self-assignment; the person's identity must be confirmed and their membership Active (BR-097), and their rights stop while their membership is suspended or inactive; preview before saving |
| Separation of duties (RB-12) | Assistance decisions are refused alongside fundraising or election-roster rights in an overlapping area |
| Identity evidence (FastAPI) | Images encrypted with AES-256-GCM, each bound to its document id, in a private directory; the database holds records only. Reviewers need `members.view_identity_evidence` over the member's area and must hold the member's identity review in review (PRM-03), never for their own record; each image opens through a link for one reviewer that expires after 5 minutes and still needs their session; the permission is checked again on every view. Links, views and refusals are audited; members see when (not who). No member download; uploads must be real JPEG, PNG or HEIC, at most 10 MB |
| Identity decisions (FastAPI) | Only holders of `members.verify` over the member's area, one claimed review at a time, never their own record; no bulk decisions; approval needs the full checklist and every required image opened by the deciding reviewer; each decision is stored with reviewer, tier, time and document versions, and the database refuses to change or delete it. Approval confirms identity only, never membership or staff rights |
| Identity appeals (FastAPI) | One appeal per adverse decision; decided only by holders of `idv.appeal.decide` over the member's area, never the original reviewer or the member; evidence opens only to the person holding the appeal; the outcome and reason are final (database trigger); an overturned decision is re-decided by someone other than the original reviewer |
| Duplicate accounts (FastAPI) | NIC hashes and phone numbers unique among active members; other signals open an investigation, decided by a holder of `idv.duplicate.investigate` over both accounts, never one of them; the finding never changes an account by itself (BR-094) and cannot be edited |
| Membership (FastAPI) | Activation, suspension, reinstatement and inactivation only by holders of `members.activate` over the member's area, never on their own record, always with a reason; history is append-only (database trigger) |
| Audit log | `ops.audit_log`: append-only (database triggers) and hash-chained; regional auditors see only their region; grants, revocations and refused access are recorded with ids only |
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
| MFA for privileged staff | With the staff app and admin dashboard |
| The identity vault in its own database and storage account with separate credentials and managed keys (INT-08, §13.8); a key-rotation tool. Today: own schema, encrypted files on `/srv/secure`, one key in the API's settings | Hosting decision (OD-20) |
| Relatives of a reviewer (BR-085); the reviewer screen's watermark (FR-WEB-006) | Relatives register, reviewer screen |
| Express `POST /api/members/:id/verification` (`is_admin`) can still set a verification status without a review | Switch it off when `/v1` verification goes live |
| Consent records before upload (BR-008), the 10-working-day appeal target, passport and device duplicate signals, KMS-held keyed hashes (FR-IDV-006) | Registration batch, hosting decision (OD-20) |
| Selfies taken only with the live camera (FR-REG-014) is enforced by the app, not the API | Member app |
| Retention periods for ID images, selfies and decisions | Waiting on OD-03 |
| Express listens on all interfaces (`*:3001`); the firewall blocks it, binding to `127.0.0.1` would add a layer | Next deploy |
| CI security scans (SAST, dependency, secret scanning) | CI batch |
| Registration has no rate limit and no phone confirmation yet; the Express sign-up accepts 6-character passwords and promotes tiers by referral count, which SG-03 forbids | Account-security batch; retire the Express sign-up |
| `npm audit`: 5 high findings in Expo's development CLI (`@expo/cli` via `node-forge`, `zod`), not in app bundles; npm's only fix is a downgrade | Next Expo patch release |
| Replacing the `karan-server-admin` SSH key, exposed in a chat on 24 October 2026 | Server owner |

## Reporting a security problem

Do not open a public issue. Tell the project owner directly, with the steps to reproduce.
