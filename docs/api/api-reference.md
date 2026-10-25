# API reference

Two APIs share one origin, one PostgreSQL database and one session:

| Prefix | Service | Status |
|---|---|---|
| `/v1/...` | FastAPI, `services/api` | Built and tested; not yet deployed |
| `/api/...` | Express, `server/` | Live; routes move to `/v1` one group at a time |

The complete, current `/v1` contract is the OpenAPI 3.1 document: `packages/api-client/openapi.json` (also served at `/docs` and `/openapi.json` outside production). Apps call it through `@my-people/api-client`.

## Sessions

Signing in sets an HttpOnly, SameSite=Lax cookie `mp_session` (Secure outside development) holding an HS256 token `{sub: member id, sv: session version}` valid for 30 days. Browsers send the cookie; mobile apps send the same token as `Authorization: Bearer <token>`. Signing out through either API increments the member's session version, which ends every session of that member in both APIs.

Writes that carry the session cookie and come from another website are refused with `403 csrf_origin_mismatch`. Every `/v1` response has `Cache-Control: no-store`. Cross-origin browser calls are allowed only from `ALLOWED_ORIGINS`, plus `http://localhost` ports in development.

## /v1 (FastAPI)

| Method and path | Session | Success | Errors |
|---|---|---|---|
| `GET /v1/health` | no | `200 {"status":"ok"}` | none |
| `GET /v1/health/db` | no | `200 {"status":"ok"}` | `503 {"status":"unavailable"}` |
| `POST /v1/auth/sign-in` body `{nic, password}` | no | `200 {token, member}` and the session cookie | `401 invalid_credentials`, `429 too_many_attempts` with `Retry-After`, `422` invalid body |
| `POST /v1/auth/sign-out` | optional | `204`, cookie cleared, all sessions ended | `403 csrf_origin_mismatch` |
| `GET /v1/members/me` | yes | `200` member profile (camelCase) | `401 unauthorized`, `401 session_expired` |
| `GET /v1/membership/me` | yes | `200 {state, reasonCode, changedAt}`; `pending` until someone activates the member | `401` |
| `GET /v1/membership/awaiting-activation?limit` | `members.activate` | `200` verified members still pending in the caller's areas | `403 forbidden` |
| `GET /v1/membership/members/{memberId}` | `members.activate` over the member's area | `200 {memberId, identityVerified, state, reasonCode, changedAt, history}` | `403 own_record`, `outside_your_area`; `404` |
| `POST /v1/membership/members/{memberId}/changes` body `{action, reasonCode, note}` | as above | `200` the membership file | as above; `422 {code: "change_refused", problems}` |
| `GET /v1/access/me` | yes | `200` the caller's staff assignments that count now (empty for members) | `401` |
| `GET /v1/access/catalogue` | `roles.assign` | `200` tiers, their area levels and the permission matrix | `403 forbidden` |
| `POST /v1/access/assignments/preview` body `{memberId, tier, area, permissions}` | `roles.assign` | `200 {allowed, problems, reviewDueAt}`, nothing saved | `403 forbidden` |
| `POST /v1/access/assignments` same body, optional `note` | `roles.assign` | `201` assignment | `403 forbidden`, `403 {code: "assignment_refused", problems}` |
| `POST /v1/access/assignments/{id}/revoke` body `{reason}` | `roles.assign` | `200` assignment, now `revoked` | `403`, `404 not_found` |
| `GET /v1/audit?actor_id&action&before_id&limit` | `audit.view` | `200` entries, newest first; a regional auditor sees only their region | `403 forbidden` |
| `GET /v1/audit/verify` | `audit.view` at platform scope | `200 {ok, checked, firstBrokenId}` | `403 platform_scope_required` |
| `GET /v1/identity/me/documents` | yes | `200` the member's current identity images: `{id, kind, version, contentType, byteSize, serverAckAt}`, never the image | `401` |
| `PUT /v1/identity/me/documents/{kind}`, body = the image, `Content-Type: image/jpeg`, `image/png` or `image/heic` | yes | `201` the new version (the server's acknowledgement) | `400 empty_file`, `413 too_large`, `415 unsupported_type`, `503 evidence_storage_not_configured` |
| `GET /v1/identity/me/evidence-views` | yes | `200 [{viewedAt, kind, role: "identity_reviewer"}]`, newest first | `401` |
| `GET /v1/identity/members/{memberId}/documents` | `members.view_identity_evidence` over the member's area, and the caller's own open review of the member | `200` the member's current identity images, without the images | `403 forbidden`, `own_record`, `outside_your_area`, `no_open_review`; `404 not_found` |
| `POST /v1/identity/documents/{documentId}/view-link` | as above | `200 {url, expiresAt}`: a path for this reviewer only, valid 5 minutes | as above |
| `GET /v1/identity/evidence/{token}` | the same reviewer's session, and as above | `200` the image, shown inline, never cached | `403 link_expired`, `link_invalid`, `link_not_yours`, `forbidden`, `outside_your_area`, `no_open_review`; `404`; `500 evidence_unreadable` |
| `GET /v1/identity/me/review` | yes | `200` the latest review `{reviewRef, route, state, submittedAt, decidedAt, history}`, or `null`; history shows the reviewer's tier, never their name | `401` |
| `POST /v1/identity/me/review` body `{route: "nic" \| "passport", declaration: true}` | yes | `200` the review: new, the same one if already open, or a correction sent back | `409 {code: "submission_refused", problems}`, `422` without the declaration |
| `GET /v1/identity/reviews?state&mine&ref&limit` | `members.verify` | `200` reviews in the caller's areas, oldest waiting first | `403 forbidden` |
| `GET /v1/identity/reviews/counts` | `members.verify` | `200 {awaitingReview, needsUpdate, assignedToMe}` | `403 forbidden` |
| `GET /v1/identity/reviews/{id}` | `members.verify` over the member's area | `200` the review file: member details, image records, decisions | `403 own_record`, `outside_your_area`; `404` |
| `POST /v1/identity/reviews/{id}/claim`, `/release` | as above | `200` the review file | as above; `409 claimed_by_another`, `not_claimed_by_you`, `not_open` |
| `POST /v1/identity/reviews/{id}/decision` body `{decision, checklist, items, reasonCategory, note}` | the reviewer holding the claim | `200` the review file | as above; `422 {code: "decision_refused", problems}` |
| `POST /v1/identity/me/review/appeal` body `{statement}` (1 to 1,000 characters) | yes | `200` the member's review; the appeal shows on the decision in `history` | `409 {code: "appeal_refused", problems: ["nothing_to_appeal" or "appeal_used"]}`, `422` |
| `GET /v1/identity/appeals?state&mine&limit` | `idv.appeal.decide` | `200` appeals in the caller's areas, oldest first | `403 forbidden` |
| `GET /v1/identity/appeals/{id}` | `idv.appeal.decide` over the member's area | `200` the appeal file: statement, the decision under appeal, the review, member details, image records | `403 own_record`, `outside_your_area`; `404` |
| `POST /v1/identity/appeals/{id}/claim`, `/release` | as above | `200` the appeal file | as above; `409 original_reviewer`, `claimed_by_another`, `not_claimed_by_you`, `not_open` |
| `POST /v1/identity/appeals/{id}/decision` body `{outcome: "uphold" \| "overturn", reason}` | the person holding the appeal | `200` the appeal file | as above; `422` without a reason |

Error bodies are `{"detail": "<code>"}`, or for a refused assignment `{"detail": {"code": "assignment_refused", "problems": [...]}}`. Problem codes: `unknown_member`, `self_assignment`, `identity_not_verified`, `tier_5_by_bootstrap_only`, `area_does_not_match_tier`, `unknown_area`, `no_permissions`, `unknown_permission:<p>`, `permission_not_for_tier:<p>`, `outside_your_area`, `tier_not_below_yours`, `permission_not_held:<p>`, `separation_of_duties`, `own_assignment`.

Every refused permission check is written to the audit log as `access.denied`. Membership actions: `activate` (from pending or inactive; needs a confirmed identity), `suspend` (from active), `reinstate` (from suspended), `inactivate` (from pending, active or suspended); problems `not_allowed_from:<state>`, `identity_not_verified`, `reason_required`, `note_required`; audited as `membership.<action>`. Staff assignment problems now include `membership_not_active` (BR-097). Identity uploads (`identity.document.uploaded`), view links (`identity.evidence.link_issued`) and every view (`identity.evidence.viewed`) are logged too. `kind` is one of `nic_front`, `nic_back`, `passport_page`, `selfie`.

Identity review states: `submitted`, `in_review`, `needs_update`, `verified`, `unable_to_verify`. Decisions: `approve` (checklist `pages_present`, `readable`, `details_match_profile`, `selfie_reviewable`, `area_checked`, and every required image opened), `request_update` (items from the route's images or `profile_details`, and a reason category), `unable_to_verify` (a reason category). Submission problems: `missing:<kind>`, `already_verified`, `route_cannot_change`, `not_updated:<item>`. Decision problems: `checklist_incomplete:<item>`, `evidence_not_viewed:<kind>`, `items_required`, `item_not_for_route:<item>`, `reason_required`, `items_only_for_request_update`, `reason_only_for_refusals`, `unknown_checklist_item:<item>`. Reviews are audited as `identity.review.submitted`, `resubmitted`, `claimed`, `released` and `decided`. A review whose decision was overturned on appeal refuses its original reviewer's claim with `409 overturned_on_appeal`; a member with an open appeal gets `appeal_pending` when submitting. Appeal states: `submitted`, `in_review`, `upheld`, `overturned`; audited as `identity.appeal.submitted`, `claimed`, `released` and `decided` (the statement and reason stay in the appeal record).

Sign-in throttling (shared with Express): failures are counted per NIC hash and client IP over 15 minutes. From 5 failures each attempt waits 0.4 s more (up to 2 s); from 10, attempts are refused for 15 minutes.

The member profile never contains the NIC, its hash, the password hash or staff review notes. Fields: `id, memberCode, fullName, phone, dob, gender, language, tier, referralCode, verificationStatus, verifiedAt, districtCode, districtName, dsCode, dsName, gsCode, gsName, joinedAt`. Express's `/api/me` also returns `avatarUrl`, `tierProgress`, `recruitCount`, `referredBy`, `nicStatus` and `isAdmin`; those move with their features.

## /api (Express, live)

| Area | Routes | Session |
|---|---|---|
| Health and config | `GET /api/health`, `GET /api/config` | no |
| Auth | `POST /api/auth/request-otp`, `verify-otp`, `signup`, `login`, `logout` | no |
| Own profile | `GET /api/me`, `PATCH /api/me`, `GET /api/me/card-token`, `POST /api/me/avatar` | yes |
| Avatars | `GET /api/avatars/:memberId` (signed, expiring URL) | signature |
| Gallery | `GET /api/gallery/albums`, `GET /api/gallery/albums/:id` | no |
| Events | `GET /api/events`, `GET /api/events/:id`, `POST /api/events/:id/rsvp` | yes |
| Community reports | `GET /api/reports/mine`, `POST /api/reports` | yes |
| Party fund | `GET /api/donations`, `GET /api/donations/mine`, `POST /api/donations/card/start`, `POST /api/donations/card/confirm` (sandbox only), `POST /api/donations/slip` | yes |
| Staff (`is_admin`) | `POST /api/members/:id/verification`, `GET /api/donations/pending`, `GET /api/donations/:id/slip`, `POST /api/donations/:id/review` | admin |

`is_admin` is a single flag that only these Express routes still read. `POST /api/members/:id/verification` can still set a member's verification status without a review; it must be switched off when `/v1` identity verification goes live. FastAPI uses staff assignments instead (role, explicit permissions and area; BRD §9). When these routes move to `/v1` (identity verification and finance), `is_admin` is dropped.
