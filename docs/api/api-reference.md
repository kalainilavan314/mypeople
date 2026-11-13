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
| `GET /v1/notifications/broadcasts?state`, `POST` body: the texts, `topic`, `{area}` and optional `audienceTiers`, `PATCH .../{id}` | `notifications.send` over the area | `200`/`201`; tiers are effective staff authorization tiers, never member ranks; `heldAt` is set when election silence first held it back | `403 outside_your_area`, `404`, `409`, `422` |
| `POST /v1/notifications/broadcasts/reach` body `{area, audienceTiers?}`, `POST .../{id}/preview` | as above | `200` with `reaches`; preview also has `problems`, `needsApproval` | `403`, `404`, `422` |
| `POST .../{id}/submit` body `{sendAt?}`, `POST .../{id}/approve`, `POST .../{id}/cancel` | as above; approval by Tier 4 or 5, not the submitter | `200` | `409 own_submission`, `approver_tier_too_low`, `not_allowed_from:<state>`; `422 {code: "broadcast_invalid", problems: ["contains_id_number"]}` |

### Community reports operations (`/v1/community/reports`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /counts` | `reports.view` | `200` actionable counts inside the caller's areas | `403` |
| `GET ?status&limit&offset` | `reports.view` | `200 {items,total,limit,offset}`; bounded and audited, without reporter identity/contact | `400 invalid_state`, `403`, `422` |
| `GET /{reportId}` | `reports.view` over the immutable submission area | `200` report detail without reporter identity/contact; access is audited | `403`, `404` |

### Community issues for members (`/v1/issues`)

Behind the `community_issues` switch (phase 2): while it is off in production every route answers `404 feature_unavailable`.

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /area` | a session | `200 {hasArea, gnNameEn, gnNameTa, updates, issues, projects}`: published issues of the member's GN division only, with the moderator's public title (H05) | `401` |
| `GET /reporting` | a session | `200 {allowed, reason, hasArea, gnNameEn, gnNameTa, categories, descriptionMin, maxPhotos}` | `401` |
| `POST /photos`, `POST /addition-photos` body = the image (`image/jpeg`, `png`, `webp`) | a session | `201 {id, width, height}`: re-encoded without metadata and sealed in the evidence store, never the gallery | `413`, `415`, `422 {code: "issue_refused", problems: ["too_many_photos_today"]}`, `503 evidence_storage_not_configured` |
| `POST /` body `{clientReference, category, title, description, locationKind: "my_gn" \| "landmark" \| "text", locationText?, visibility: "team" \| "public", photoIds}` | Verified and Active (FR-RPT-017) | `201` the receipt (`CI-` case number, stage 1, next step); the same `clientReference` returns the first receipt | `422 {code: "issue_refused", problems}`: `identity_not_verified`, `membership_not_active`, `location_required`, `no_area_on_profile`, `too_many_reports_today`, `photo_not_found` |
| `GET /mine` | a session | `200 {items}` the member's reports, newest first | `401` |
| `GET /{id}` | the reporter, or a published issue in the member's GN (or one they follow) | `200` the four-stage stepper with dates, status, responsible tier; `report` only for the reporter (question asked, next step, linked case, closure response) | `404 not_found` |
| `PUT /{id}/follow` body `{follow}` | as above | `200` | `404`, `422 not_public` |
| `POST /{id}/information` body `{body, photoIds}` | Verified and Active; the reporter or a published issue | `201 {id, state: "pending", isReply}`; the reporter's answer to a request for details returns the case to the GN stage | `404`, `422 cannot_add_information`, `photo_not_found` |
| `POST /{id}/closure-response` body `{resolved, rating?, note?}` | the reporter, within 30 days of closure | `200`; `resolved: false` challenges the closure (a note is required) and alerts the closing tier | `404`, `422 not_closed`, `already_responded`, `challenge_window_closed`, `note_required` |

### Case workflow for staff (`/v1/cases`)

Same switch. Each endpoint needs a case permission (`cases.collect`, `cases.research`, `cases.decide_district`, `cases.plan_regional`, `cases.approve_executive`, `cases.implement_and_close`) or `content.moderate`; the service then checks the case's area, its stage and the caller's tier (Tiers 2B and 3B never send a decision). Cases outside the caller's areas answer `404`. Every action answers `200` with the updated case file; refusals are `403 forbidden` or `own_record` (audited) and `409 {code: "case_refused", problems}`, for example `wrong_stage`, `facts_required`, `completeness_check_incomplete`, `owner_not_eligible`, `evidence_required`, `bilingual_summary_required`.

| Endpoint | Stage and permission | Effect |
|---|---|---|
| `GET ?stage&mine&overdue&districtClosures&search&limit&offset` | any | `200 {items, total, counts}`; overdue first |
| `GET /{id}` | any (read audited) | the case file with history, evidence, additions, linked reports, open challenge and `allowedActions` |
| `GET /{id}/owners?permission` | any | deciding holders of the permission over the case's area |
| `GET /{id}/reporter-contact` | the owner, with `cases.view_reporter_contact` | name, phone and member code; audited |
| `GET /{id}/photos/{photoId}`, `POST /{id}/photos` | any | the WebP image (`no-store`, audited); a case photo for progress or closure |
| `POST /{id}/facts` `{statement, source}` | GN, `cases.collect` | W03 fact with its source |
| `POST /{id}/findings` `{kind, statement, source?}` | DS, `cases.research` | W04 finding (`verified_fact` needs a source) |
| `POST /{id}/notes` `{text}` | any open stage | a note |
| `POST /{id}/return` `{question}` | GN, deciding | Returned; the reporter is asked |
| `POST /{id}/link` `{parentCaseNumber, note?}` | GN, deciding | Linked to the parent; the reporter hears the parent's progress |
| `POST /{id}/forward` `{locationConfirmed, descriptionClear, evidenceReviewed, ownerId, note}` | GN, deciding | to DS with a named owner |
| `POST /{id}/ds-report` `{summary, evidenceRefs, recommendation, districtOwnerId}` | DS, deciding | to the district |
| `POST /{id}/district-decision` `{decision: "act" \| "escalate", ...}` | district, `cases.decide_district` | act within authority (implementation) or escalate (regional) |
| `POST /{id}/regional-plan` `{solution, responsibleTier, resources, expectedOutcome, reportingPlan}` | regional, `cases.plan_regional` | to Tier 5 |
| `POST /{id}/executive-decision` `{decision: "approve" \| "return" \| "decline", ...}` | executive, `cases.approve_executive` | approve with conditions, return, or decline |
| `POST /{id}/progress` `{step, evidenceRefs, photoIds}` | implementation, the owner | progress evidence |
| `POST /{id}/close` `{outcome, evidenceRefs, photoIds, limitations?, summaryEn, summaryTa}` | implementation, the owner | Resolved; district closures are reported to Tiers 4 and 5 |
| `POST /{id}/assign` `{ownerId, note}` | the stage's tier or the tier above | a handoff in the stage, or taking an unassigned case |
| `POST /{id}/challenge-decision` `{accept, reason, stage?, ownerId?, dueDate?}` | resolved with an open challenge, district or executive | reopen at a stage with a new owner, or reject |
| `POST /{id}/public-summary` `{publish, titleEn, titleTa, summaryEn, summaryTa, reason?}` | a public report, `content.moderate` | publish or withhold the public summary |
| `POST /{id}/additions/{additionId}/moderation` `{approve, reason?}` | `content.moderate` | approve or reject added information |

### Volunteering (`/v1/volunteering`)

Behind the `volunteering` switch (phase 2). Refusals are `422 {code: "volunteer_refused", problems}`; coordinator endpoints need `volunteers.manage` over the opportunity's area (`403 outside_your_area`, `own_record`). A volunteer's phone number is never returned and no list ranks volunteers.

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /skills` | a session | `200 {skills, availability, profile}` (H10) | `401` |
| `PUT /profile` body `{skills, availability, travelArea: "my_gn" \| "my_ds", consent}` | a session | `200` the profile; saved only with consent | `422 consent_required`, `skills_required`, `unknown_skill` |
| `DELETE /profile` | a session | `204`; consent withdrawn, profile deleted | none |
| `GET /opportunities`, `GET /opportunities/{id}` | a session | open opportunities in the member's area with the five briefing elements, `saved` and `myOffer` (H11) | `404` |
| `POST /opportunities/{id}/offer`, `DELETE .../offer` | Verified and Active | `201` the offer (`VF-` receipt, also in My Activity); withdraw before a decision | `422 identity_not_verified`, `membership_not_active`, `opportunity_not_open`, `already_offered`, `request_a_change_instead` |
| `PUT /opportunities/{id}/saved` body `{saved}` | a session | `200` | `404` |
| `GET /assignments` | a session | `200` offers and confirmed assignments with role, meeting point, history and messages (H12) | `401` |
| `POST /offers/{id}/contact` body `{kind: "message" \| "change_request", body, confirmed: true}` | the volunteer | `201`; the coordinators are told; a change request keeps the assignment | `422 confirmation_required`, `not_confirmed`, `offer_closed` |
| `GET /manage/opportunities?state`, `POST /manage/opportunities`, `PATCH .../{id}` | `volunteers.manage` | drafts and opportunities in the coordinator's areas, with places, confirmed and waiting counts | `403`, `422 starts_in_past`, `ends_before_start`, `unknown_skill`, `unknown_area` |
| `POST /manage/opportunities/{id}/state` body `{state: "open" \| "closed" \| "cancelled", reason?}` | as above | `200`; cancelling tells everyone who offered | `422 not_allowed_from:<state>`, `reason_required` |
| `GET /manage/opportunities/{id}/offers` | as above | offers by time, with skills only where the volunteer consented | `403`, `404` |
| `POST /manage/offers/{id}/decision` body `{confirm, roleEn?, roleTa?, meetingPointEn?, meetingPointTa?, reason?}` | as above | `200`; the volunteer is told | `403 own_record`, `422 meeting_point_required`, `places_filled`, `reason_required`, `not_awaiting_decision` |
| `GET /manage/inbox`, `POST /manage/inbox/{id}/answer` body `{answer}` | as above | open messages and change requests; the answer reaches the volunteer | `422 already_answered` |
| `GET /manage/volunteers?skill` | as above | consented skills profiles in the coordinator's areas, by name | `403` |

### Ideas, surveys and development proposals (`/v1/ideas`, `/v1/surveys`, `/v1/proposals`)

Ideas and surveys sit behind the `ideas_surveys` switch, proposals behind `development_proposals` (both phase 2). Refusals are `422 {code: "idea_refused" | "survey_refused" | "proposal_refused", problems}`.

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/ideas` | a session | `200 {local, mine}`: published ideas of the member's area, and their own in every state (H13) | `401` |
| `POST /v1/ideas` body `{title (≤80), benefit}` | Verified and Active | `201` the idea (`ID-` receipt, pending moderation, in My Activity) | `422 identity_not_verified`, `membership_not_active`, `no_area_on_profile`, `too_many_ideas_today` |
| `PUT /v1/ideas/{id}/support` body `{support}`, `POST .../withdraw` | Verified and Active, in the idea's area | `200`; one support per member, never a change of status | `404`, `422 own_idea` |
| `GET /v1/ideas/moderation`, `POST /v1/ideas/{id}/moderation` body `{publish, reason?}` | `content.moderate` over the area | pending ideas; publish or reject with a reason; the author is told | `403 own_record`, `outside_your_area`; `422 reason_required`, `already_moderated` |
| `GET /v1/surveys`, `GET /v1/surveys/{id}` | a session, in the survey's area | open surveys with the member's receipt; questions, audience, privacy statement, `canAnswer` (H14) | `404` |
| `POST /v1/surveys/{id}/responses` body `{answers}` | Verified, in the area | `200` with the `SR-` receipt and "What happens next" (H21); anonymous surveys store answers with no link to the member | `422 answer_required:n`, `answer_invalid:n`, `already_answered`, `survey_closed` |
| `GET/POST /v1/surveys/manage`, `PUT .../{id}` (drafts), `POST .../{id}/state` `{state}`, `GET .../{id}/results` | `surveys.manage` over the area | drafts with questions; open and close; counts with groups of 1 to 9 hidden | `403`, `422 anonymous_surveys_cannot_be_edited`, `questions_required`, `options_required:n`, `only_drafts_change` |
| `GET /v1/proposals?q&category` | a session | `200 {area, mine}`: published proposals touching the member's area and their own (M15); `q` matches words | `401` |
| `POST /v1/proposals` body `{clientReference, title, category, area: {level: district \| ds \| gn, code}, problem, solution, benefit, costEstimate?, evidence?}` | Verified and Active | `201` the proposal (`DP-`), pending moderation; the same clientReference returns the first | `422 unknown_area`, `too_many_proposals_today` |
| `GET /v1/proposals/{id}`, `PUT` (revise a rejected one), `POST .../withdraw` | the author, or a published proposal in the area | stage, reason and history with the recording tier (M17) | `404`, `422 only_rejected_proposals_are_revised` |
| `GET /v1/proposals/manage?stage&q&category`, `GET .../{id}`, `POST .../{id}/stage` body `{stage, reason?}` | `content.moderate` (publish or reject), `dev.review` (not taken forward), `dev.approve_planning` (approved for planning, funding identified, implementation) | the D15 queue and moves; the author is told | `403 forbidden` (the tier lacks the authority), `own_record`; `422 not_allowed_from:<stage>`, `reason_required` |
| `GET /v1/proposals/manage/needs` | `dev.review` or `dev.approve_planning` | counts by area and category; groups under 10 hidden, also by subtraction | `403` |

AI topic, duplicate and summary suggestions and semantic search (FR-DEV-004, 005) are not built: they wait for the AI provider decision (OD-42).

### Learning and invitations (`/v1/learning`, `/v1/invitations`)

Behind the `learning` and `invitations` switches (phase 2).

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/learning/courses` | a session | `200 {available, mine, completed}` with lessons and minutes (H15) | `401` |
| `GET /v1/learning/courses/{id}` | a session | the lessons, which are complete, and `resumePosition` (H16) | `404` (drafts; retired courses only for those who started) |
| `POST /v1/learning/courses/{id}/lessons/{lessonId}/complete` | a session | progress recorded only here; the last lesson completes the course (My Activity) and never changes a role | `404` |
| `POST /v1/learning/courses/{id}/save-exit` body `{lessonId}` | a session | the lesson to resume at; nothing is marked complete | `404` |
| `GET/POST /v1/learning/manage/courses`, `GET/PUT .../{id}` (drafts), `POST .../{id}/state` `{state: published \| retired}` | `content.moderate` [ASSUMPTION: the BRD names no permission] | course authoring | `403`, `422 {code: "learning_refused", problems: ["only_drafts_change" \| "lessons_required" \| "not_allowed_from:<state>"]}` |
| `GET /v1/invitations/mine` | a session | `200 {referralCode, invitations: [{number, status: "shared" \| "pending" \| "active", createdAt}]}`: never who joined (H20) | `401` |
| `POST /v1/invitations` body `{language}` | Verified and Active | `201 {number, url, preview}`: the link carries only an opaque `INV-` token (FR-REF-004); `MEMBER_APP_URL` sets its address | `422 membership_not_active`, `too_many_invitations_today` |

Registration (`POST /v1/identity/register`) accepts an invitation token in `referralCode`; each token admits one person, and the inviter then sees Pending, and Active once the membership is activated. Referral counts never become permissions, rewards, rankings or priority.

### Promise Tracker and scorecards (`/v1/promises`, `/v1/scorecards`)

Behind the `promises` and `scorecards` switches (phase 2). Refusals are `422 {code: "promise_refused" | "scorecard_refused", problems}`.

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/promises?status&theme&area` | a session | every published promise (M18), labelled party commitment or government responsibility | `401` |
| `GET /v1/promises/{id}`, `POST .../feedback` `{body}` | a session; feedback from Verified and Active members | milestones, approved updates with corrections beside the originals, moderated feedback and the office's replies (M19) | `404`, `422 membership_not_active` |
| `POST /v1/promises/manage`, `PUT .../{id}` (drafts), `POST .../{id}/request-publication` | `promise.edit` over the area | drafts with milestones; publication waits for a second person | `422 milestones_required`, `due_before_start`, `published_promises_change_by_update` |
| `POST /v1/promises/manage/{id}/publication-decision` `{approve, reason?}` | `promise.publish` | published, or back to draft with a reason | `403 own_draft` (the person who asked) |
| `POST /v1/promises/manage/{id}/updates` `{newStatus?, noteEn, noteTa, evidenceRefs, correctsId?}`, `POST .../updates/{id}/decision` | `promise.edit` drafts, `promise.publish` approves | dated updates applied only on approval; Completed needs evidence, Withdrawn and Blocked a reason; a published promise past its due date becomes Delayed automatically and the office is asked for an update within 10 working days | `422 evidence_required`, `reason_required`, `not_allowed_from:<status>`; `403 own_draft` |
| `GET /v1/promises/manage`, `.../pending`, `.../report`, feedback moderation and replies | `promise.edit`, `promise.publish` or `content.moderate` | the D16 lists, pending approvals and feedback, counts by status, theme, office and area | `403` |
| `GET /v1/scorecards/area` | a session | the member's GN, DS division and district for the last four published quarters (M20); `{insufficient: true}` under 10 accepted cases; every value with numerator and denominator | `401` |
| `POST /v1/scorecards/manage` `{period}`, `.../{id}/share`, `PUT .../{id}/notes`, `.../{id}/publish` | `scorecard.publish` | compute a finished quarter, share for 10 working days, context notes, publish | `422 period_not_finished`, `draft_exists`, `review_period_running` |
| `POST /v1/scorecards/manage/{id}/corrections`, `.../corrections/{id}/decision` | a case permission to ask; `scorecard.publish` to decide | an accepted correction recomputes the figures; on a published scorecard it publishes the next version and keeps the earlier one | `422 unknown_metric`, `already_decided` |

### Community Support (`/v1/assistance`)

Behind the `community_support` switch (phase 2). Help never depends on membership, verification, donations or political support, and no response carries any of them (FR-AST-009). The `assistance` schema has row-level security: its rows are invisible unless the module opens them for its own transaction. Refusals are `422 {code: "support_refused", problems}`.

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /` | a session | `200 {emergencyContacts, categories, requests}` (M11): the official numbers first | `401` |
| `POST /requests` body `{category, summary, emergency, consent, fullName, phone?, household?, area?}` | any session (no membership needed) | `201` with a random `AS-` reference that encodes nothing; emergencies alert intake staff at once | `422 consent_required`, `unknown_area` |
| `POST /public-requests` (same body) | none | `201 {caseRef}` | `422 phone_required`, `too_many_requests` (5 an hour per address) |
| `GET /requests/{id}`, `POST .../appeals` `{decisionId, kind: appeal \| complaint, body}` | the applicant | status, decisions with reasons, help delivered, appeals (M13, M14) | `404`, `422 already_appealed` |
| `GET /manage/cases?state`, `POST /manage/intake` | `assistance.intake`, `casework` or `decide` | the queue: decision-makers see their areas, others unassigned screening cases and their own; S11 hotline and partner intake | `403` |
| `GET /manage/cases/{id}` and the actions under it (`assign`, `link`, `notes`, `decision`, `deliveries`, `referrals`, `close`) | the assigned caseworker, or `assistance.decide` over the area; intake only while unassigned in screening | the case file with duplicate suggestions (FR-AST-006); every opening audited; decisions cite a criteria version with reasons in both languages; deliveries only after a decision; each referral needs that partner's consent | `403 not_assigned` (audited); `422 criteria_version_required`, `reason_required`, `partner_consent_required`, `not_a_suggested_duplicate` |
| `GET /manage/appeals`, `POST /manage/appeals/{id}/decision` `{change, reason, outcome?, criteriaVersionId?, reasonTa?}` | `assistance.decide` | uphold, or record a new decision that replaces the earlier one | `403 original_decider` |
| `GET/POST /manage/programmes`, `POST .../{id}/criteria`, `.../{id}/active`, `GET/POST /manage/partners` | `assistance.programme.manage` to change | programmes with versioned criteria (D14) and partners | `403` |
| `GET /manage/statistics` | `assistance.decide` or `assistance.programme.manage` | counts by area, category and state; under 10 hidden, also by subtraction | `403` |

### Town halls (`/v1/town-halls`)

Behind the `town_halls` switch (phase 2). The streaming provider is not chosen (OD-44, DEP-20): a session keeps the provider's stream, audio-only and caption links once known. Voice questions wait for Tamil speech-to-text (OD-42).

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /`, `GET /{id}?q` | a session, in the session's area | sessions; approved questions with vote totals and the member's own (with the moderator's reason) | `404` |
| `POST /{id}/questions` `{body}`, `POST /questions/{id}/vote`, `PUT /{id}/reminder` `{remind}` | Verified and Active to ask | held for moderation; one vote per approved question; reminders 24 hours and 15 minutes before | `422 session_closed`, `too_many_questions`, `own_question` |
| `GET/POST /manage`, `GET/PUT /manage/{id}`, `POST /manage/{id}/state` `{state, reason?}` | `townhall.produce` (and `townhall.moderate` to read) | draft, schedule, go live, end or cancel | `409 silence_period`; `422 legal_review_required`, `not_allowed_from:<state>` |
| `POST /manage/questions/{id}/moderation` `{decision, reason?, mergeInto?}` | `townhall.moderate` | approve, merge or reject with a reason; the author is told | `422 reason_required`, `merge_target_not_approved` |
| `POST /manage/questions/{id}/answer` `{mode, atSecond?, answerEn?, answerTa?}`, `POST /manage/{id}/archive` | `townhall.produce` | live answers with the time, written answers in both languages; recording, transcripts and outcomes linked to promises or cases | `422 time_required`, `bilingual_answer_required` |

### Field visits and the election duty roster (`/v1/field`, `/v1/election/roster`)

Behind the `field_visits` and `election_roster` switches (phase 2). Neither records a vote choice, intention, preference or proof of voting, and field visits have no field for political classification.

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `POST /v1/field/visits/sync` `{visits: [{clientId, baseVersion?, gnCode, visitedAt, consent, concerns, notes?, placeText?, followUp?, caseNumber?, confirmedNotPolitical?}]}` | `field.collect` | one result per visit: `created`, `updated`, `conflict` (with the server copy) or `refused` with `problems` (`outside_your_area`, `concerns_required`, `political_content`, `not_your_visit`); a declined visit keeps no text | `403` |
| `GET /v1/field/visits/mine?since`, `GET /v1/field/manage/visits?openFollowUps`, `GET /v1/field/manage/counts`, `POST /v1/field/manage/visits/{id}/follow-up` | `field.collect` over the area | the coordinator's visits, the supervisor's area (D24), counts kept after the 12-month deletion | `403` |
| `GET /v1/election/roster/mine`, `POST .../assignments/{id}/answer` `{accept}`, `.../check-in` `{siteConfirmed?}`, `.../check-out` | the volunteer | M30 shifts; check-in from an hour before the shift to its end, never a location | `422 not_accepted`, `outside_shift_time`, `already_checked_in` |
| `GET/POST /v1/election/roster/manage/shifts`, `GET .../{id}`, `POST .../{id}/offers` `{memberCode}`, `.../cancel`, `.../messages` | `election.roster.manage` over the area | shifts in a declared period's area, offers to Verified and Active members in the shift's area, operational messages to the people on the shift | `422 period_not_declared`, `outside_the_election_area`, `places_filled`, `member_outside_shift_area` |
| `GET /v1/election/roster/periods/{id}/report` | `election.mode.manage` | FR-ELX-009 counts: shifts, roster changes and messages, broadcasts sent, content published, silence blocks | `403`, `404` |

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

Enabling `community_finance` also fails with `409 policy_decisions_required:<keys>` until the latest revisions of FIN-01, FIN-02, FIN-03 and FIN-05 are approved.

### Phase 1 policy decisions (`/v1/policy-decisions`)

All endpoints require `system.configure`. Proposed defaults returned by the API are context only; they are never treated as approval.

| Endpoint | Success | Errors |
|---|---|---|
| `GET /v1/policy-decisions` | `200` the fixed FIN/STF/GOV/CARD catalogue, current revision, owner roles and missing approvals | `403` |
| `GET /v1/policy-decisions/{key}` | `200` one decision file and its evidence | `403`, `404` |
| `POST /v1/policy-decisions/{key}/revisions` body `{decisionText, rationale, effectiveFrom?}` | `201` a new draft; approved/rejected history remains immutable | `404`, `409 active_revision_exists` |
| `PATCH /v1/policy-decisions/{key}/revisions/{id}` with the same body | `200` the updated draft | `404`, `409 revision_not_draft` |
| `POST .../{id}/submit` body `{reason}` | `200` the immutable revision in `in_review` | `404`, `409 revision_not_draft`, `decision_content_incomplete` |
| `POST .../{id}/reviews` body `{role, outcome, reviewerName, reviewerTitle, evidenceRef, comment, reviewedAt}` | `200`; approval occurs only after every required role approves; one rejection closes the revision | `404`, `409 revision_not_in_review`, `review_role_not_required`, `review_role_already_recorded`, `review_date_in_future` |

Review evidence is append-only. The external signed record remains in its controlled document store; the API records only its reference and the staff actor who entered it.

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

### Community Finance (`/v1/fund`, `/v1/finance`)

| Endpoint | Needs | Success | Errors |
|---|---|---|---|
| `GET /v1/finance-readiness` | `system.configure` | `200 {ready, checks, controls, reviewerCount, approverCount, distinctFinanceStaffCount, receiptLastNumber, receiptRemaining, cardPaymentsEnabled: false, automatedEvidenceDeletionEnabled: false}` | `403` |
| `POST /v1/finance-readiness/controls` body `{controlKey, decisionRevisionId, integerValue?, textValue?, evidenceRef, reason}` | `system.configure` | `201` immutable control version tied to the exact latest approved FIN revision | `409 approved_current_decision_required`, `control_already_recorded_for_decision`, invalid control/value codes |
| `GET /v1/fund/config` | none | `200 {currency, amountPresets, bankName, accountName, accountNumber, accountNumberMasked, branchName, transferInstructionsEn, transferInstructionsTa, disclaimerEn, disclaimerTa, noRewardStatementEn, noRewardStatementTa, intakeAvailable}`; bank fields are `null` unless intake is enabled and fully configured | `404 feature_unavailable` |
| `POST /v1/fund/contributions` with required `Idempotency-Key` header and body `{amountMinor, currency="LKR", transferDate, bankReference, declarationVersion, noPrivilegeAcknowledged, informationAccurateAcknowledged, payingForSelf}` | a session | `200 {id, contributionRef, amountMinor, currency, transferDate, bankReference, status: "DRAFT", hasSlip: false, createdAt, updatedAt, timeline: []}` | `422 idempotency_key_required`, `idempotency_key_invalid`, `third_party_payment_not_allowed`, validation errors; `409 idempotency_conflict`; `503 finance_not_configured`, `finance_not_production_ready:<checks>` |
| `PUT /v1/fund/contributions/{id}/slip` body: binary JPEG/PNG (max 15 MB) | a session | `204` | `400 empty_file`, `413 too_large`, `415 unsupported_type`, `422 invalid_image_dimensions`, `422 malware_detected`, `503 finance_scanner_unavailable` |
| `POST /v1/fund/contributions/{id}/submit` | a session | `200` contribution in `SUBMITTED` status | `400 slip_required`, `mandatory_declarations_required`, `409 not_allowed_from:<status>` |
| `GET /v1/fund/contributions/mine` | a session | `200 [contribution]` | `401` |
| `GET /v1/fund/contributions/{id}` | a session | `200` contribution detail with sanitized timeline | `401`, `404` |
| `GET /v1/fund/contributions/{id}/receipt` | a session | `200 {receiptCode: "CN-XXXXX", contributionRef, amountMinor, currency, transferDate, issuedAt, status: "VERIFIED"}` | `404 not_found` (only returned once independently verified) |
| `GET /v1/finance/contributions?status&month&risk_flag&reference&mine&limit&offset` | `finance.review`, `finance.approve`, `finance.export`, or `finance.audit_read` | `200 {items: [summary], total}` | `403` |
| `GET /v1/finance/contributions/{id}` | as above | `200` staff detail with risk flags, declarations, reconciliation, approval, receipt, and timeline | `403`, `404` |
| `POST /v1/finance/contributions/{id}/claim` | `finance.review` | `204`; `SUBMITTED`/`ON_HOLD` moves to `PENDING_REVIEW` | `403 own_record`, `404`, `409 already_claimed`, `cannot_claim_from_status:<status>` |
| `POST /v1/finance/contributions/{id}/slip-view` | `finance.review`, `finance.approve`, or `finance.audit_read` | `200 {token, expiresAt, viewUrl}` (5-minute single-use viewer token) | `403`, `404`, `409 no_slip_uploaded` |
| `GET /v1/finance/slips/{token}` | the staff session that requested the single-use token | first use returns the streamed image with `Cache-Control: no-store, private` | `403 invalid_slip_view_token`, `viewer_mismatch` |
| `POST /v1/finance/contributions/{id}/reconcile` body `{action: "matched"\|"needs_correction"\|"reject"\|"hold", statementReference?, reason}` | `finance.review` | `204` | `400 statement_reference_required`, `reason_required`, `403 own_record`, `404`, `409 not_allowed_from:<status>` |
| `POST /v1/finance/contributions/{id}/approve` body `{action: "approve"\|"reject"\|"hold", reason, relatedPartyConflict: bool}` | `finance.approve` | `200` receipt response or `null` | `400 reason_required`, `403 own_record`, `same_person_approval_forbidden` (separation of duties), `conflict_of_interest` (related party conflict), `404`, `409 not_allowed_from:<status>` |
| `GET /v1/finance/ledger.csv?month=YYYY-MM` | `finance.export` | `200` CSV with formula-injection sanitization (`'` prepended to `=`, `+`, `-`, `@`, `\t`, `\r`) | `400 invalid_month`, `403` |

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

## Analytics (D32)

| Endpoint | Signed in | Answer | Refusals |
|---|---|---|---|
| `GET /v1/analytics/operations?periodDays=7\|30\|90` (default 30) | staff with `analytics.view` | `200` counts for the caller's areas: `started, submitted, verified, active, completionRate`, `decided, medianHours, withinTargetRate`, `waiting, overTarget`, `events, going, attended, attendanceRate`, `periodDays, generatedAt, platformWide`. A count is `null` when it would show 1 to 9 people, directly or by subtraction (RR-02) | `401`, `403 forbidden`, `422 period_days_must_be_7_30_or_90` |

## Offline check-in (MP-DEC-001 4.3 to 4.5)

| Endpoint | Signed in | Answer | Refusals |
|---|---|---|---|
| `POST /v1/events/{id}/checkin/offline` `{deviceId, deviceKey (the token from /v1/operations/devices), scans: [{scanEventId, idempotencyKey, code, clientScanAt, localOutcome}]}` (1 to 200) | `events.checkin_scan` over the event | `200 {outcomes: [{scanEventId, status, reason, memberCode}]}`; status `ACCEPTED`, `DUPLICATE`, `REJECTED`, `NEEDS_REVIEW` (`clock_ahead`) or `EXPIRED_QUEUE` (`too_old`); a repeated idempotency key returns the first outcome | `403 device_not_registered` (unknown, revoked or another person's phone), `forbidden`, `outside_your_area`; `404`; `409 offline_attendance_not_approved` (no current approved STF-01 replay window) |
| `GET /v1/events/{id}/checkin/exceptions` | `events.manage` over the event | `200` waiting scans: `scanEventId, status, reason, clientScanAt, serverReceivedAt`; no member named | `403`, `404` |
| `POST /v1/events/checkin/exceptions/{scanEventId}/decision` `{decision: accepted\|rejected, reason}` | `events.manage` | `200` the outcome | `409 own_scan`, `already_settled`, `pass_<reason>`; `403`, `404` |
