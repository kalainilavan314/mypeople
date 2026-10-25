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
| NIC | Stored only as SHA-256 of `NIC_PEPPER` + normalised NIC |
| Sign-in throttling | Per NIC hash and client IP: delay from 5 failures, 15-minute lockout from 10; shared by both APIs |
| Client IP | Express trusts only the local proxy (`trust proxy` = loopback, `req.ip`); Nginx sets `X-Forwarded-For $remote_addr`; FastAPI must run uvicorn with `--proxy-headers --forwarded-allow-ips=127.0.0.1` behind Nginx |
| Timing | FastAPI runs bcrypt even for unknown NICs, so response time does not reveal registered NICs |
| CSRF | Cookie-authenticated writes from another origin get `403 csrf_origin_mismatch` (both APIs) |
| Headers | `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`; API responses `Cache-Control: no-store` |
| OTP | Stored as HMACs; per-phone and per-IP limits; burned after 5 wrong guesses |
| Card QR | Carries an opaque, signed, 10-minute token, never NIC or date of birth |
| Avatars and slips | Served through signed, expiring URLs or admin-only routes |
| Errors | 5xx details go to a private `error_log` table, never to the response |
| Network | Firewall allows only 22, 80, 443; PostgreSQL listens on localhost |
| Backups | Encrypted, off-server restic backups daily and before each release, integrity-checked |
| Dependencies | `npm audit` clean for the Express API (October 2026) |

## Not yet in place

| Gap | Planned in |
|---|---|
| Roles, permissions and geographic scope (only an `is_admin` flag today) | Access module, next backend batch |
| MFA for privileged staff | With the staff app and admin dashboard |
| General append-only audit log (only `verification_audit` today) | Access module |
| Private object storage with 5-minute signed URLs for identity evidence | Document-storage batch |
| Retention periods for ID images, selfies and decisions | Waiting on OD-03 |
| Express listens on all interfaces (`*:3001`); the firewall blocks it, binding to `127.0.0.1` would add a layer | Next deploy |
| CI security scans (SAST, dependency, secret scanning) | CI batch |
| Replacing the `karan-server-admin` SSH key, exposed in a chat on 24 October 2026 | Server owner |

## Reporting a security problem

Do not open a public issue. Tell the project owner directly, with the steps to reproduce.
