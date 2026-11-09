# API reference

Two APIs share one origin, one PostgreSQL database and one session:

| Prefix | Service | Status |
|---|---|---|
| `/v1/...` | FastAPI, `services/api` | Built and tested; not yet deployed |
| `/api/...` | Express, `server/` | Live; routes move to `/v1` one group at a time |

The complete, current `/v1` contract is the OpenAPI 3.1 document: `packages/api-client/openapi.json` (also served at `/docs` and `/openapi.json` outside production). Apps call it through `@my-people/api-client`.

## Sessions

Signing in sets an HttpOnly, SameSite=Lax cookie `mp_session` (Secure outside development) holding an HS256 token `{sub: member id, sv: session version}`. Browsers send the cookie; mobile apps send the same token as `Authorization: Bearer <token>`. Signing out through either API increments the member's session version, which ends every session of that member in both APIs.

Express tokens last 30 days. Tokens from `/v1` also name a session row (`sid`), so one session can be ended on its own and an unused one expires after 30 days; they last **15 minutes** and are renewed with the refresh token that sign-in and registration return (`refreshToken`, also set as the HttpOnly, SameSite=Strict cookie `mp_refresh` on path `/v1/auth`). Each refresh token works once: `POST /v1/auth/refresh` returns a new pair. An expired token answers `401 token_expired`; renew it and send the request again. A refresh token that was already used means a copy exists: the session ends for every copy (`401 refresh_reused`) and the member gets a security alert (FR-AUTH-025).

Writes that carry the session cookie and come from another website are refused with `403 csrf_origin_mismatch`. Every `/v1` response has `Cache-Control: no-store`. Cross-origin browser calls are allowed only from `ALLOWED_ORIGINS`, plus `http://localhost` ports in development.

## /v1 (FastAPI)

| Method and path | Session | Success | Errors |
|---|---|---|---|
| `GET /v1/health` | no | `200 {"status":"ok"}` | none |
| `GET /v1/health/db` | no | `200 {"status":"ok"}` | `503 {"status":"unavailable"}` |
| `POST /v1/auth/sign-in` body `{nic, password}` or `{passportNumber, passportCountry, password}` | no | `200 {token, refreshToken, member}` and both cookies; a sign-in the risk rules flag also raises a security alert, in the inbox and by SMS | `401 invalid_credentials`, `429 too_many_attempts` with `Retry-After`, `422` invalid body |
| `POST /v1/auth/refresh` body `{refreshToken}` (browsers send `{}` and the `mp_refresh` cookie) | no | `200 {token, refreshToken}` and both cookies; the refresh token sent stops working | `401 invalid_refresh_token`, `session_expired` (ended or 30 days unused), `refresh_reused` (the session is ended and the member alerted); cookies cleared |
| `GET /v1/auth/security-alerts` | yes | `200 [{id, kind: "suspicious_sign_in" \| "refresh_reuse", signals, deviceLabel, createdAt, answeredAt, answer, sessionActive}]`, newest first (M50) | `401` |
| `POST /v1/auth/security-alerts/{id}/answer` body `{answer: "it_was_me" \| "not_me"}` | yes | `200` the alert; `not_me` ends the flagged session and every other one except the caller's | `404 not_found`, `409 already_answered` |
| `POST /v1/identity/register` body `{fullName, route, idNumber, passportCountry?, password, acceptTerms: true, language, dob?, gender?, districtCode?, dsCode?, gsCode?, referralCode?, surveyAnswers?}` | no | `201 {token, refreshToken, member, referralAccepted}` and both cookies | `409 already_registered`, `422 {code: "registration_refused", problems}` or an invalid body |
| `GET /v1/identity/notices` | no | `200 {termsAndPrivacy, identityReview}` notice versions | none |
| `POST /v1/identity/me/consent` body `{noticeVersion}` | yes | `204`; recorded once | `409 notice_outdated` |
| `GET /v1/identity/me/progress` | yes | `200 {route, steps: [{name, done}], nextStep, reviewState}` | `401` |
| `GET /v1/geography/districts`, `/districts/{code}/ds-divisions`, `/ds-divisions/{code}/gn-divisions` | no | `200 [{code, nameEn, nameTa, nameSi}]` | `404 not_found` |
| `GET /v1/identity/me/phone` | yes | `200 {phone}` or `null` | `401` |
| `POST /v1/identity/me/phone` body `{phone}` | yes | `202 {sent, devCode}` (devCode only in development), whether or not another account has the number | `422 invalid_phone`, `429 too_many_requests`, `503 sms_not_configured` |
| `POST /v1/identity/me/phone/confirm` body `{phone, code}` | yes | `200 {phone}` | `401 invalid_code`, `too_many_attempts`; `409 phone_unavailable` (another account has the number) |
| `POST /v1/auth/recovery/request` body `{nic}` or `{passportNumber, passportCountry}` | no | `202 {sent: true}`, the same whether or not the number is registered; the SMS goes after the answer | `503 sms_not_configured` |
| `POST /v1/auth/recovery/verify` body: the number and `{code}` | no | `200 {resetToken, expiresInSeconds}` | `401 invalid_code`, `too_many_attempts` |
| `POST /v1/auth/recovery/reset` body `{resetToken, newPassword}` | no | `204`; every session ends | `401 invalid_reset_token`, `422 {code: "password_refused", problems}` |
| `POST /v1/auth/recovery/assisted` body: the number and `{contactMethod, contactValue?, message?}` | no | `202 {reference}` | `429 too_many_requests` |
| `GET /v1/identity/recovery-requests`, `POST /v1/identity/recovery-requests/{id}/resolve` body `{outcome: "contact_replaced" \| "declined", newPhone?, note}` | `members.verify` over the member's area (platform scope for requests that matched no account) | `200` | `403`, `target_outranks_you` (replacing the number of a staff account at or above your tier); `404`, `409 not_open`, `no_matching_account`, `phone_unavailable` |
| `POST /v1/auth/sign-out` | optional | `204`, cookie cleared; all sessions ended only when the token still works | `403 csrf_origin_mismatch` |
| `GET /v1/auth/sessions` | yes | `200 [{id, deviceLabel, createdAt, lastSeenAt, current}]` | `401` |
| `POST /v1/auth/sessions/{id}/revoke`, `POST /v1/auth/sessions/revoke-others` | yes | `204` | `404 not_found` |
| `GET /v1/auth/mfa` | yes | `200 {enrolled, enabled, sessionVerified}` | `401` |
| `POST /v1/auth/mfa/totp` | yes | `200 {secret, otpauthUri}` | `409 already_enabled` |
| `POST /v1/auth/mfa/totp/confirm`, `POST /v1/auth/mfa/verify` body `{code}` | yes | `204`; the second factor is given for this session | `401 invalid_code`, `too_many_attempts` (five in this session; it is ended); `409 not_enrolled`, `session_not_registered`; `429 mfa_locked` with `Retry-After` (five wrong codes on the authenticator in any sessions) |
| `GET /v1/members/me` | yes | `200` member profile (camelCase) | `401 unauthorized`, `401 session_expired`, `401 token_expired` (renew and retry; every endpoint with a session can answer this) |
| `GET /v1/membership/me` | yes | `200 {state, reasonCode, changedAt}`; `pending` until someone activates the member | `401` |
| `GET /v1/membership/me/card` | yes | `200 {available, identityVerified, membershipState, reasonCode, displayName, memberCode, designation, districtName, gnName, memberSince, lastScannedAt, publicCard}` (card fields null unless available) | `401` |
| `GET /v1/membership/me/card/code` | yes | `200 {code, expiresAt, refreshAfterSeconds: 60}` | `409 card_not_available` |
| `POST /v1/membership/card/scan` body `{code}` | `events.checkin_scan` | `200 {result: "valid" \| "expired" \| "not_valid", displayName, memberCode}` | `403` |
| `GET /v1/membership/lookup?code` | `members.view_profile` | `200 {memberId, memberCode, fullName, districtName, gnName, identityVerified, membershipState}` for one member in the caller's areas, exact member ID only; audited | `403`, `404 not_found` (also outside the caller's areas) |
| `GET /v1/membership/awaiting-activation?limit` | `members.activate` | `200` verified members still pending in the caller's areas | `403 forbidden` |
| `GET /v1/membership/members/{memberId}` | `members.activate` over the member's area | `200 {memberId, identityVerified, state, reasonCode, changedAt, history}` | `403 own_record`, `outside_your_area`; `404` |
| `POST /v1/membership/members/{memberId}/changes` body `{action, reasonCode, note}` | as above | `200` the membership file | as above; `403 target_outranks_you` (a staff member at or above your tier); `422 {code: "change_refused", problems}` |
| `GET /v1/access/me` | yes | `200` the caller's staff assignments that count now (empty for members) | `401` |
| `GET /v1/access/catalogue` | `roles.assign` | `200` tiers, their area levels and the permission matrix | `403 forbidden` |
| `GET /v1/access/assignments?state=active\|revoked&limit` | `roles.assign` | `200` assignments in the caller's own areas with `memberCode` and `fullName`, newest first | `403 forbidden` |
| `POST /v1/access/assignments/preview` body `{memberId, tier, area, permissions}` | `roles.assign` | `200 {allowed, problems, reviewDueAt}`, nothing saved | `403 forbidden` |
| `POST /v1/access/assignment-previews` body `{memberCode, tier, area, permissions, note?}` | `roles.assign` | `201 {id, expiresAt}` opaque, 10-minute staff-bound preview | `403 forbidden`, `403 {code: "assignment_refused", problems}` |
| `GET /v1/access/assignment-previews/{id}`, `POST .../{id}/confirm`, `POST .../{id}/cancel` | `roles.assign`, and only the preview owner | display, create one assignment atomically, or cancel | `404 preview_expired_or_invalid` |
| `POST /v1/access/assignments/{id}/revoke` body `{reason}` | `roles.assign` | `200` assignment, now `revoked` | `403`, `404 not_found` |
| `GET /v1/access/reviews?limit` | `audit.view` | `200 {quarter, quarterEndsAt, reviewedThisQuarter, items}`: grants in the caller's areas, below their tier, not their own, due by the end of this quarter (overdue ones first, `overdue: true`), each with `memberCode`, `fullName` and `lastReviewedAt` (FR-AUTH-027, D31) | `403 forbidden` |
| `POST /v1/access/reviews/{assignmentId}` body `{decision: "confirmed" \| "revoked", reason}` | `audit.view` over the grant's area, from a higher tier | `200` the assignment: confirmed ones are due at the end of the next quarter (and count again if they had lapsed); revoked ones end at once | `403 own_assignment`, `outside_your_area`, `tier_not_below_yours`, `tier_5_by_bootstrap_only`; `404 not_found`; `409 not_due` (already reviewed this quarter); `422` reason under 3 characters |
| `GET /v1/audit?actor_id&action&before_id&limit` | `audit.view` | `200` entries, newest first; a regional auditor sees only their region | `403 forbidden` |
| `GET /v1/audit/verify` | `audit.view` at platform scope | `200 {ok, checked, firstBrokenId}` | `403 platform_scope_required` |
| `GET /v1/identity/me/documents` | yes | `200` the member's current identity images: `{id, kind, version, contentType, byteSize, serverAckAt}`, never the image | `401` |
| `PUT /v1/identity/me/documents/{kind}`, body = the image, `Content-Type: image/jpeg`, `image/png` or `image/heic` | yes | `201` the new version (the server's acknowledgement), with `quality: {checked, problems}`: M01 advice (`blurry`, `too_dark`, `glare` on ID pages, `too_small`); `checked: false` for HEIC. Advice only: the image counts as received either way | `400 empty_file`, `413 too_large`, `415 unsupported_type`, `429 upload_limit` with `Retry-After` (12 images in 24 hours), `503 evidence_storage_not_configured` |
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
| `POST /v1/identity/duplicates` body `{memberId, otherMemberId, reason}` | `members.verify` over the member's area, holding the member's identity review | `200` the case (an existing pair returns its case) | `403`, `no_open_review`; `404`, `422 {code: "report_refused", problems}` |
| `GET /v1/identity/duplicates?state&mine&limit` | `idv.duplicate.investigate` | `200` cases in the caller's areas, oldest first | `403 forbidden` |
| `GET /v1/identity/duplicates/{id}` | `idv.duplicate.investigate` over both accounts' areas | `200` both accounts with details, verification and membership state, image records | `403 own_record`, `outside_your_area`; `404` |
| `POST /v1/identity/duplicates/{id}/claim`, `/release`, `/decision` body `{outcome: "not_duplicate" \| "duplicate_confirmed", reason}` | the investigator holding the case for decisions | `200` the case file | as above; `409 claimed_by_another`, `not_claimed_by_you`, `not_open`, `reported_by_you` (the reporter never investigates) |

### Notifications (`/v1/notifications`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/notifications?view=all\|action_needed&topic&before&limit` | a session | `200 {items, unread, actionNeeded}`; each item has `targetKind`, `targetId`, `actionNeeded`, `read` | `422` |
| `POST /v1/notifications/{id}/read`, `POST /v1/notifications/read-all` | a session | `204` (reading never clears Action needed) | `404` |
| `GET`/`PUT /v1/notifications/choices` body `{topics: [{topic, push, sms}], quietStart?, quietEnd?, clearQuietHours?}` | a session | `200` choices with `locked` topics | `409 topic_locked`, `422` |
| `POST /v1/notifications/devices` body `{token, platform}`, `POST .../devices/unregister` body `{token}` | a session | `204` | `422` |
| `GET /v1/notifications/broadcasts?state`, `POST` body: the texts, `topic` and `{area}`, `PATCH .../{id}` | `notifications.send` over the area | `200`/`201`; `heldAt` is set when an election silence first held it back | `403 outside_your_area`, `404`, `409`, `422` |
| `POST .../{id}/preview` | as above | `200` with `reaches`, `problems`, `needsApproval` | `403`, `404` |
| `POST .../{id}/submit` body `{sendAt?}`, `POST .../{id}/approve`, `POST .../{id}/cancel` | as above; approval by Tier 4 or 5, not the submitter | `200` | `409 own_submission`, `approver_tier_too_low`, `not_allowed_from:<state>`; `422 {code: "broadcast_invalid", problems: ["contains_id_number"]}` |

### Profile and privacy (`/v1/profile`, `/v1/auth/password`, `/v1/privacy`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/profile`, `PATCH /v1/profile` body `{displayName?, gender?, language?: "ta" \| "en"}` | a session | `200` the profile with `lockedFields`, `mobileMasked`, `verificationValidUntil`, `openAreaChange`, `language` | `401`, `422` |
| `GET /v1/profile/activity?kind&limit` | a session | `200` receipts newest first | `422` unknown kind |
| `GET`/`PUT /v1/profile/survey-answers` body `{answers}`, `DELETE` | a session | `200` the answers; `204` | `422` |
| `GET /v1/profile/identity-data` | a session | `200` purpose and retention of each kind of identity data | `401` |
| `POST /v1/profile/area-changes` body `{gnCode}` | a session | `201` receipt (`AC-`) | `409 request_open`, `same_area`, `unknown_area` |
| `PUT /v1/profile/area-changes/{id}/proof` body = the image | the requester | `200` submitted | `404`, `409 not_awaiting_proof`, `413`, `415`, `503` |
| `GET /v1/profile/area-changes/mine`, `POST .../{id}/withdraw` | the requester | `200` | `404`, `409 not_open` |
| `GET /v1/profile/area-changes?state`, `GET .../{id}/proof`, `POST .../{id}/decision` body `{decision: "approve" \| "decline", reason}` | `members.verify` over the requested area | `200` | `403 own_record`, `outside_your_area`; `404`; `409 not_submitted` |
| `POST /v1/auth/password` body `{currentPassword, newPassword}` | a session | `204`; every session ends | `401 wrong_password`, `422 password_refused`, `429` |
| `POST /v1/privacy/closure-code` | a session | `202 {sent, devCode}` | `409 no_recovery_number`, `429`, `503 sms_not_configured` |
| `POST /v1/privacy/requests` body `{kind: "copy" \| "closure", note?, password?, code?}` | a session | `201` receipt (`DSR-`) with `dueAt` and, for a closure, `retention` | `401 wrong_password`, `invalid_code`, `too_many_attempts`; `409 no_recovery_number`; `422` |
| `GET /v1/privacy/requests/mine` | a session | `200` | `401` |
| `GET /v1/privacy/requests?state`, `POST .../{id}/decision` body `{outcome: "completed" \| "refused", note}` | `privacy.requests.handle` | `200` | `403 own_record`, `404`, `409 already_closed` |

### Home and gallery (`/v1/home`, `/v1/content`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/home` | a session | `200 {layout, displayName, districtName, gnName, identityState, reviewRef, membershipState, nextStep, comingUp, quickActions, tabs, hub}` | `401` |
| `GET /v1/content/albums?category&q&limit`, `GET /v1/content/albums/{id}` | a session | `200` published albums; detail with publisher, summary, linked event and numbered photos | `404 not_found` |
| `GET /v1/content/photos/{id}/thumb`, `.../display` | a session | `200 image/webp`, inline | `404`, `503 media_storage_not_configured` |
| `POST /v1/content/photos/{id}/removal-requests` body `{reason, note?}` | a session | `201` receipt `{requestRef, state, handledBy, createdAt, dueAt}` (the open one if asked again) | `404` |
| `GET /v1/content/removal-requests/mine` | a session | `200` the member's receipts | `401` |
| `POST /v1/content/removal-requests/public` body `{albumRef, photoNumber, reason, note?, contact}` | none | `201` receipt | `404`, `429 too_many_requests` |
| `GET /v1/content/albums/manage`, `GET .../manage/{id}`, `POST /v1/content/albums`, `PATCH /v1/content/albums/{id}` | `gallery.publish` over the album's area | `200`/`201` the album | `403`, `404`, `409 not_allowed_from:<state>`, `422 {code: "album_invalid", problems}` |
| `POST /v1/content/albums/{id}/photos` body = the image (`image/jpeg`, `image/png`, `image/webp`) | as above, a draft | `201` the photo | `400 empty_file`, `413 too_large`, `too_many_pixels`, `415 unsupported_type`, `503` |
| `PATCH /v1/content/photos/{id}` body `{captionEn?, captionTa?}`, `DELETE /v1/content/photos/{id}` | as above, a draft | `200`, `204` | `403`, `404`, `409` |
| `POST /v1/content/albums/{id}/submit`, `.../publish`, `.../return` body `{note}` | as above | `200` the album | `409 own_submission`, `not_allowed_from:<state>`, `silence_period` (publishing during an election silence in the area); `422 album_invalid` (`tamil_caption_missing`, `event_required`, …) |
| `GET /v1/content/removal-requests?state&limit` | `gallery.takedown` | `200` the queue with `escalated` | `403` |
| `POST /v1/content/removal-requests/{id}/decision` body `{decision: "remove" \| "blur" \| "keep", reason}` | `gallery.takedown` over the album's area | `200` the receipt | `403 own_record`, `404`, `409 already_decided` |

### Events (`/v1/events`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/events?scope=mine\|all&area&until&type&participation&q&limit` | a session | `200` events still to come with `myResponse` and `placesLeft` | `401` |
| `GET /v1/events/{id}` | a session | `200` detail with agenda, meeting point, accessibility, contact route, `myHistory`, `attendedAt` | `404 not_found` (drafts too) |
| `PUT /v1/events/{id}/rsvp` body `{response: "going" \| "maybe" \| "declined"}` | a session | `200 {response}`: the state recorded, `waitlisted` when full | `404`, `409 event_cancelled`, `event_over` |
| `GET /v1/events/{id}/pass`, `GET /v1/events/{id}/pass/code` | a session | `200` the pass; `{code, expiresAt}` valid 60 seconds | `404`, `409 not_going`, `membership_not_active`, `event_cancelled`, `event_over` |
| `GET /v1/events/manage?state&limit`, `GET /v1/events/manage/{id}` | `events.manage` | `200` events in the caller's areas, drafts included | `403 outside_your_area`, `404` |
| `POST /v1/events` body: the details and `{area}` | `events.manage` over the area | `201` a draft | `403`, `422 {code: "event_invalid", problems}` |
| `PATCH /v1/events/{id}`, `POST .../publish`, `POST .../cancel` body `{reason}` | `events.manage` over the event's area | `200` the event, with `notified` (members sent an SMS) | `403`, `404`, `409 not_allowed_from:<state>`, `silence_period` (publishing during an election silence in the area, or an event inside one), `422` |
| `POST /v1/events/{id}/scan` body `{code}` | `events.checkin_scan` over the event's area | `200 {result, fullName?, memberCode?, attendedAt?}`: `checked_in`, `already_checked_in`, `expired`, `wrong_event`, `outside_window`, `not_valid` | `403`, `404` |
| `POST /v1/events/{id}/checkin/manual` body `{memberCode, reason}` | `events.checkin_scan` over the event's area | `200 {result, fullName?, memberCode?, attendedAt?}`: `checked_in`, `already_checked_in`, `outside_window`, `not_eligible`, `not_valid` | `403`, `404`, `422` |
| `GET /v1/events/{id}/attendance` | `events.checkin_scan` (or `events.manage`) over the event's area | `200 {expected, attended, entries}`; each entry has `checkinMethod` (`scan` or `manual`) | `403`, `404` |

### Feature flags (`/v1/features`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/features` | none | `200 {enabled: [keys]}`: the v1.1 modules that are on (every module outside production unless `ENFORCE_FEATURE_FLAGS`) | none |
| `GET /v1/features/registry` | `system.configure` | `200 [{key, nameEn, phase, requiredGate, enabled, gate, approvalRef, gateRecordedAt}]` | `403` |
| `POST /v1/features/{key}/gate` body `{gate, approvalRef, reason}` | `system.configure` | `200` the flag | `404`, `409 gate_must_be:<gate>` |
| `POST /v1/features/{key}/enable`, `.../disable` body `{reason}` | `system.configure` | `200` the flag | `404`, `409 gate_not_recorded` (enable only) |

Any route of a module that is off answers `404 feature_unavailable`.

### Election (`/v1/election`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/election/current` | a session; the `election_mode` feature | `200 [{periodRef, electionType, titleEn, titleTa, pollingDay, daysToPolling, inSilence, silenceStartsAt, silenceEndsAt, labelEn, labelTa, sourceUrl, sourceReference, sourcePublishedAt, notices}]` for periods whose area contains the member's | `404 feature_unavailable` |
| `GET /v1/election/periods?state&limit` | `election.mode.manage` | `200` declared periods by default | `403` |
| `POST /v1/election/periods` body `{electionType, titleEn, titleTa, area, startsAt, endsAt, silenceStartsAt, silenceEndsAt, pollingDay, sourceUrl, sourceReference, sourcePublishedAt}` | `election.mode.manage` over the area | `201` the period with `overlaps` (a warning) | `403`, `422 {code: "election_invalid", problems}`: `ends_before_start`, `already_over`, `silence_ends_before_start`, `silence_outside_period`, `silence_must_cover_polling_day`, `source_in_future`, `unknown_area` |
| `GET /v1/election/periods/{id}` | as above | `200` the period with every notice | `403`, `404` |
| `POST /v1/election/periods/{id}/close` body `{action: "end" \| "withdraw", reason}` | as above | `200` the period | `403`, `404`, `409 not_allowed_from:<state>` |
| `POST /v1/election/periods/{id}/notices` body `{source: "election_commission" \| "party", titleEn, titleTa, bodyEn, bodyTa, sourceUrl?, documentReference?, sourcePublishedAt?}` | as above | `201` the notice with its label | `403`, `404`, `409`, `422 election_invalid` (`official_source_required`) |
| `POST /v1/election/notices/{id}/withdraw` | as above | `200` the notice | `403`, `404`, `409 already_withdrawn` |

Error bodies are `{"detail": "<code>"}`, or for a refused assignment `{"detail": {"code": "assignment_refused", "problems": [...]}}`. Problem codes: `unknown_member`, `self_assignment`, `identity_not_verified`, `tier_5_by_bootstrap_only`, `area_does_not_match_tier`, `unknown_area`, `no_permissions`, `unknown_permission:<p>`, `permission_not_for_tier:<p>`, `outside_your_area`, `tier_not_below_yours`, `permission_not_held:<p>`, `separation_of_duties`, `own_assignment`.

Registration problems: `invalid_name`, `invalid_id_number`, `invalid_passport_country`, `password_too_short`, `password_too_long`, `password_too_common`, `password_contains_id_number`, `dob_in_future`, `dob_too_early`, `under_minimum_age`, `area_incomplete`, `unknown_area`. Uploads answer `409 consent_required` until identity-review consent is given; a review on the wrong route gets `route_mismatch`.

Every refused permission check is written to the audit log as `access.denied`. Staff endpoints answer `403 mfa_enrolment_required` or `mfa_required` until the staff member has given their authenticator code in this session. Session tokens from this API carry a session id (`sid`); send a stable app install id as `X-Device-Id`. Membership actions: `activate` (from pending or inactive; needs a confirmed identity), `suspend` (from active), `reinstate` (from suspended), `inactivate` (from pending, active or suspended); problems `not_allowed_from:<state>`, `identity_not_verified`, `reason_required`, `note_required`; audited as `membership.<action>`. Staff assignment problems now include `membership_not_active` (BR-097). Identity uploads (`identity.document.uploaded`), view links (`identity.evidence.link_issued`) and every view (`identity.evidence.viewed`) are logged too. `kind` is one of `nic_front`, `nic_back`, `passport_page`, `selfie`.

Identity review states: `submitted`, `in_review`, `needs_update`, `verified`, `unable_to_verify`. Decisions: `approve` (checklist `pages_present`, `readable`, `details_match_profile`, `selfie_reviewable`, `area_checked`, and every required image opened), `request_update` (items from the route's images or `profile_details`, and a reason category), `unable_to_verify` (a reason category). Submission problems: `missing:<kind>`, `already_verified`, `route_cannot_change`, `not_updated:<item>`. Decision problems: `checklist_incomplete:<item>`, `evidence_not_viewed:<kind>`, `items_required`, `item_not_for_route:<item>`, `reason_required`, `items_only_for_request_update`, `reason_only_for_refusals`, `unknown_checklist_item:<item>`. Reviews are audited as `identity.review.submitted`, `resubmitted`, `claimed`, `released` and `decided`. A review whose decision was overturned on appeal refuses its original reviewer's claim with `409 overturned_on_appeal`; a member with an open appeal gets `appeal_pending` when submitting. The review file lists `duplicateFlags` (`caseRef`, `state`, `signal`, `otherMemberId`). Duplicate case states: `open`, `in_review`, `not_duplicate`, `duplicate_confirmed`; audited as `identity.duplicate.opened`, `claimed`, `released` and `decided`. Appeal states: `submitted`, `in_review`, `upheld`, `overturned`; audited as `identity.appeal.submitted`, `claimed`, `released` and `decided` (the statement and reason stay in the appeal record).

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
