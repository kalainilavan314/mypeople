# Phase 2 checklist against MP-FEA-002

This checklist covers every screen and rule in the *Phase 2 Feature and Function List* (MP-FEA-002 v1.0, 3 November 2026). Each was checked against the code itself on 13 November 2026, not against the documentation. The check found 34 of the 63 screens fully done, 21 partly done, 1 missing (M07) and 7 blocked. Every gap that needed no decision was then fixed in the same pull request (PR #24, Alembic 0042 to 0044).

**Result: 56 of 63 screens are built. The other 7 wait on a decision or an outside dependency.** Some built screens have one part that also waits on a decision (marked ⛔ in their row).

✅ done · ⚠️ done, with the limit named · ⛔ waits on the decision or dependency named

Nothing here is live for members yet. Every module sits behind its own switch until Gate G2 (`docs/requirements/phase2-status.md`).

## 2.1 My Area and issue reporting (RPT) · `/v1/issues` · app `issues/`

| Item | Status | Notes |
|---|---|---|
| H05 Updates, Issues and Projects for the member's GN | ✅ | |
| H05 List view always available | ✅ | |
| H05 Schematic map without GPS | ⛔ | Waits on GN boundary data. The list is always there |
| H05 Shows the area scorecard (M20) | ✅ | GN card with numerator, denominator and period; hidden while scorecards are off |
| H06 Public summary, case ID, stage, responsible tier, four-stage bar | ✅ | One four-stage bar on H06 and H09 (OD-13 recommendation) |
| H06 Follow and be notified at each stage | ✅ | |
| H06 Add information, held for moderation | ✅ | The author can appeal a rejection once |
| H07 Fixed category list; my GN, a landmark or text | ✅ | GPS is never asked for |
| H07 Description of at least 20 characters | ✅ | |
| H07 Photos with location data removed | ✅ | Re-encoded into the encrypted evidence store |
| H07 Draft kept on the phone without network | ✅ | |
| H08 Review before sending; Team only by default | ✅ | |
| H08 Public summary never shows names, contacts or photos | ✅ | |
| H09 Receipt with case ID, next step and tier | ✅ | |
| H09 Notified at each stage, when details are asked for, and at closure | ✅ | |
| H09 Rate or challenge the closure within 30 days | ✅ | |
| Only verified, active members report (FR-RPT-017) | ✅ | Photo uploads too. A member with no GN on their profile is told to set it first |
| Photos stay in the restricted evidence store | ✅ | |
| Public summaries only after moderation (D12) | ✅ | The closing summary goes to the reporter only; others see the moderated public summary |

## 2.2 Case escalation for staff (WEB) · `/v1/cases` · dashboard `/cases`

| Item | Status | Notes |
|---|---|---|
| W03 Location, description, affected area, evidence, restricted contact, follow-up log | ✅ | The affected area is required before forwarding |
| W03 Facts with their source; return for details instead of deleting | ✅ | |
| W03 Link duplicates; forward to DS after a completeness check and a named owner | ✅ | |
| W04 Facts apart from assumptions, options, stakeholders, resources, questions | ✅ | |
| W04 Tiers 2B and 3B add notes, never decide | ✅ | |
| W05 Act within authority (authority, resources, office, owner, scope) or escalate | ✅ | |
| W05 Resolution report to Tiers 4 and 5 for every district closure | ✅ | |
| W06 Solution, tier, resources, outcome and reporting plan, to Tier 5 | ✅ | |
| W07 Approve with conditions, return, or decline with a reason | ✅ | |
| W08 Owner, due date, approved scope, steps and progress evidence | ✅ | |
| W08 Closing report with outcome, evidence, limits, Tamil and English summary | ✅ | |
| W08 Reopen on an accepted challenge with reason and new owner | ✅ | |
| Every handover records previous owner, new owner, note and time | ✅ | Append-only history; every handover carries a note |
| Stage timer alerts the next tier on breach | ✅ | A case with no named owner tells every holder of the stage's permission |
| Limits GN 3, DS 7, district 10, regional 15, executive 10 working days | ⚠️ | BRD 4.3 values pending OD-10. Monday to Friday; public holidays are not counted |
| Staff never act on their own report | ✅ | Includes moderating it |

## 3.1 Volunteering (VOL) · `/v1/volunteering`

| Item | Status | Notes |
|---|---|---|
| H10 Skills, availability, travel area; consent before saving | ✅ | |
| H11 Briefing with time, place, role, what to bring, team; Offer to help or Save for later | ✅ | The offer is recorded in My Activity |
| H12 Confirmed role, time, meeting point and event pass; election duties listed too | ✅ | Opens the pass directly when the member has one |
| H12 Contact through an approved route; a change request needs a reason | ✅ | |
| S10 Coordinators confirm offers and assign roles | ✅ | Staff section and dashboard |
| No volunteer phone numbers; no rankings | ✅ | |

## 3.2 Ideas and surveys (IDEA, SRV) · `/v1/ideas`, `/v1/surveys`

| Item | Status | Notes |
|---|---|---|
| H13 Local ideas and my own; title up to 80 characters and benefit; reviewed first | ✅ | "Local" means the member's GN, DS division and district |
| H13 One support per member per idea | ✅ | |
| H14 One question per screen, "Question n of N", progress bar, back and review, "Prefer not to say" | ✅ | |
| H21 Receipt, "What happens next", My Activity record | ✅ | |
| Support never changes status; posting approves nothing | ✅ | |
| Anonymity claimed only when technically anonymous | ⚠️ | Answers and the participation record are written in separate transactions. Someone with database access could still pair them by order; fully unlinkable answers would need batched writes. Wording waits on OD-21 |
| Target area only, one response per member | ✅ | |

## 3.3 Learning (LRN) and 3.4 Invitations (REF) · `/v1/learning`, `/v1/invitations`

| Item | Status | Notes |
|---|---|---|
| H15 Available and My courses with lessons and duration; completed history | ✅ | Retired courses stay in the history |
| H16 "Lesson n of N"; saved only on Complete lesson; resume after Save and exit | ✅ | |
| Completion in My Activity and My progress; never changes role or authority | ⚠️ | Course titles in My progress are English only |
| H19 Referral code with one-tap copy; preview; share sheet or link; no contacts access | ⚠️ | Copy needs the next APK build on phones (new native module); it works on the web now |
| H20 Neutral labels; only Shared, Pending, Active | ⚠️ | An invitation is created only when shared. Android cannot report a share sheet closed unsent, so one such invitation may still show as Shared |
| Opaque token with no personal data | ✅ | |
| Referral counts never become permissions, rewards, rankings or priority | ⚠️ | The new apps give nothing for referrals. The live web app still raises a member's tier from their referral count; the owner chose on 13 November 2026 to keep that for now. Labels wait on OD-24 |

## 4.1 My Household (HH) · `/v1/households` · app `household/`

| Item | Status | Notes |
|---|---|---|
| M06 One household per verified member, with ID and District, DS, GN | ✅ | `HH-` code |
| M06 Leave at any time | ✅ | The first adult to join becomes head; the household ends when no adult remains |
| M07 Adults: name, relationship, age band, occupation; never another adult's NIC, passport or phone | ✅ | Adults join only by invitation and set their own age band and occupation (OD-30 recommendation) |
| M07 Children: first name, relationship, birth year, guardian; no photo, no account | ✅ | Added by a verified adult, who becomes the guardian (OD-31 recommendation) |
| M08 Invite an adult through the share sheet or their member account | ✅ | The inviter never sees the other person's name before they accept |
| M09 Accept or decline; recorded only after confirming | ✅ | |
| M10 View, correct, delete; withdraw consent; every change logged | ✅ | The household's adults see the change log |
| D02 Authorised staff manage records in their area | ⚠️ | Read-only: no household management permission exists. Opening a household needs the household's caseworker consent |
| Visible only to confirmed adults and, with recorded consent, a caseworker | ✅ | Enforced by row-level security, now also tested as a non-superuser |
| Never used for political, campaign or fundraising work; analytics see aggregates only | ✅ | No other module reads household tables |
| Known edge | ⚠️ | The 0021 policy still lets a household's creator read its name and area after leaving |

## 4.2 Community Support (AST) · `/v1/assistance` · app `support/`, public `/help/support`, dashboard `/support`

| Item | Status | Notes |
|---|---|---|
| M11 Official emergency numbers first; categories; my requests | ✅ | Numbers to confirm: 119, 1990, 117, 1929, 1938 |
| M12 The ten categories | ✅ | |
| M12 Consent to collect, and again for each partner referral | ✅ | Members agree or refuse each referral in the app; for hotline and public-form requests the caseworker records the applicant's consent |
| M13 AS- reference revealing nothing; status and next step | ✅ | |
| M14 One complaint or appeal per decision, decided by someone else | ✅ | |
| S11 Requests from the hotline, a public web form or a partner, without membership | ✅ | Dashboard intake; public form at `/help/support` (no account) |
| S11 Duplicate check by applicant and household; suggest linking | ✅ | Matches the same person by name, phone or account, never a household description alone |
| S12 Only the assigned caseworker and decision-makers; every access logged | ✅ | Intake staff see only the summary until a caseworker is assigned |
| S12 Help delivered and referrals recorded | ✅ | |
| D13 Decisions against the published criteria version, with reasons and decider | ✅ | Only the current version of an active programme covering that kind of help |
| D14 Programmes, criteria, partners; public statistics as anonymous aggregates | ✅ | Public district counts; groups under 10 hidden, also against subtraction |
| Never show membership, political support, contributions, attendance or campaign data | ✅ | |
| No one holds assistance decisions with fundraising or roster rights (FR-AST-013) | ⚠️ | Enforced in any area when a role is granted. "Campaign" rights wait on OD-32 |
| Own tables with row-level security | ✅ | |
| Before go-live | ⛔ | OD-32 governance, DEP-18 partner agreements, DEP-19 legal opinion; pilot in one district |

## 5.1 Development ideas (DEV) · `/v1/proposals`

| Item | Status | Notes |
|---|---|---|
| M15 Proposals for my area and my own, with stage | ✅ | GN, DS and district |
| M15 Search in Tamil and English by meaning | ⛔ | OD-42 (AI-09). Word search meanwhile |
| M16 Title, area, category, problem, solution, benefit; offline draft | ✅ | |
| M17 Stage, reason, next step; author notified of every change | ✅ | |
| D15 Moderation with a reason for rejection; stages to implementation; regional needs | ✅ | |
| D15 AI topic, duplicates, bilingual summary | ⛔ | OD-42 (AI-07, AI-08) |
| Popularity never approves; the authorised tier records each stage; groups under 10 hidden | ✅ | |

## 5.2 to 5.4 Promises, scorecards, town halls · `/v1/promises`, `/v1/scorecards`, `/v1/town-halls`

| Item | Status | Notes |
|---|---|---|
| M18 All promises by status, area, theme; on Home and in the Hub | ✅ | |
| M19 PR- ID, publication, office, due date, status, dated updates with evidence, last verified, moderated feedback and replies | ✅ | Status reasons in Tamil and English |
| D16 Create and update with evidence; a second person approves; reports by status, area, theme, office | ✅ | Neither the drafter nor the requester can approve |
| Only the six statuses; overdue becomes Delayed; update within 10 working days | ✅ | Overdue promises accept only Completed or Withdrawn; a missed update is raised once with the publishers |
| Withdrawn stay visible; party commitments and government responsibilities labelled | ✅ | Validation waits on OD-34 |
| M20 GN, DS, district: accepted, closed with evidence, resolution and on-time rate; last four periods; numerator, denominator, period on every value | ✅ | |
| D17 Shared with responsible tiers for 10 working days; corrections recorded; versioned | ✅ | Sharing notifies the case handlers of those areas; a new version supersedes the old |
| "Insufficient data" under 10 accepted cases; no person ranked | ✅ | Publication policy waits on OD-33 |
| M21 Adaptive video, audio-only, captions | ⛔ | OD-44, DEP-20 streaming provider. Provider links open once set |
| M22 Questions shown after moderation; one vote each; totals only | ✅ | Verified and Active members; only while scheduled or live |
| M22 Voice questions | ⛔ | OD-42 (AI-11) |
| M23 Recordings, Tamil and English transcripts, question history, outcomes linked | ✅ | Transcripts are entered by staff until AI-08; links are checked |
| D18 Schedule with language, speakers, area; approve, merge, reject with reason; answered live or in writing | ✅ | Cancelling tells everyone who asked for a reminder |
| No live session in a silence period; legal review in an election period | ✅ | Checked at scheduling and again at going live. Moderation staffing waits on OD-35 |

## 6.1 to 6.3 Election, field work, official content · `/v1/election/roster`, `/v1/field`, `/v1/fact-checks`

| Item | Status | Notes |
|---|---|---|
| M29 Election information | ⛔ | DEP-19 legal opinion; OD-37 data sources |
| M30 Accept or decline shifts; check in and out, optional site confirmation, no tracking | ✅ | |
| S15 Shifts, roles, sites; messages to rostered volunteers in scope | ✅ | On the dashboard (`/roster`); messages go to accepted volunteers |
| No vote choice, intention, prediction or proof of voting | ✅ | |
| Election-period audit report: messages, roster changes, content published | ✅ | Counts and a list of entries, limited to the period's area |
| S05 Consent first; without it no personal data | ✅ | A declined visit keeps nothing, on the phone or the server |
| S05 Concerns, non-sensitive notes, follow-up, case reference; place optional (GN or DS by hand) | ✅ | Voting-intention phrases are always refused |
| S06 Only inside the coordinator's area | ✅ | |
| S07 Encrypted offline storage (AES-256, device keystore); sync statuses; conflicts to resolve | ✅ | A resend of the same visit is "unchanged", not a conflict |
| D24 Supervisors see visits and follow-ups in their area | ✅ | |
| No political fields; deleted after retention; counts kept | ✅ | 12 calendar months (OD-38 recommendation) |
| Known limit | ⚠️ | The Tamil வாக்களி also means "promised", so such a note must be reworded |
| M47 Official updates with signed labels and revision history | ⛔ | INT-24 signing keys |
| M48 Check a statement by code or link | ⛔ | INT-24. The app says so |
| M48 Report misinformation with a link or screenshot | ✅ | |
| D12 One queue: ideas, report summaries, added information, misinformation | ✅ | Proposals and moderation appeals too |
| D12 Approve, redact or reject with a reason; one appeal; full audit | ✅ | Redact publishes an edited version; one appeal per decision, decided by another moderator |
| D30 Signing with keys in KMS | ⛔ | INT-24 |
| An AI score is never proof; a fact-checker decides (BR-149) | ✅ | No score is stored or shown |

## 6.4, 6.5 Renewal, WhatsApp, alerts

| Item | Status | Notes |
|---|---|---|
| M33, M34, D25 Renewal and certificates | ⛔ | OD-43 renewal policy |
| WhatsApp reminders and notices | ⛔ | OD-45, DEP-21 |
| Official flood and cyclone alert relay (may move from Phase 3) | ⛔ | DEP-23 |

## 7 AI in Phase 2

| Item | Status | Notes |
|---|---|---|
| AI-07 topics and duplicates, AI-08 summaries, AI-09 search, AI-11 speech-to-text, AI-12 triage | ⛔ | OD-42 provider and hosting. Each screen works without AI; nothing pretends to be AI |
| AI-04, AI-05 liveness and face comparison | ⛔ | OD-28 and OD-42 |

## 8 Data, privacy and security

| Rule | Status | Notes |
|---|---|---|
| Household, assistance and field data in their own tables with row-level security; no cross-purpose joins | ⚠️ | All three are under forced row-level security. It binds only a database user that is not a superuser or `BYPASSRLS`: **the production user must be checked** |
| Neutrality firewall | ✅ | Help never depends on membership, donations or politics; FR-AST-013 as above |
| Consent per purpose | ✅ | Each adult's own household entry, the support case, each partner referral, every field note |
| Small numbers hidden | ✅ | Assistance statistics, regional needs, scorecards, survey results |
| Evidence protection | ✅ | Photos without location data in the restricted store; offline field forms encrypted on the device |
| Access logging | ✅ | Every assistance case opening, moderation, appeal and fact-check decision |
| No political profiling | ✅ | |
| Election safeguards | ✅ | |
| Security gates: DPIA update, row-level security tests, penetration test, signing-key ceremony | ⚠️ | The row-level security tests exist. The DPIA, penetration test and key ceremony are organisational steps for Gate G2 |

## 9 Decisions the build assumes (the BRD's recommendations)

| Decision | Built as |
|---|---|
| OD-10 case time limits | GN 3, DS 7, district 10, regional 15, executive 10 working days |
| OD-13 progress bar | Four stages on H06 and H09 |
| OD-21 survey anonymity wording | Results always hide groups under 10; each survey's privacy text is written by staff, so the agreed wording must be used there |
| OD-24 invitee labels | Neutral labels only |
| OD-30 household consent | Each adult confirms their own entry; caseworker consent given by the head |
| OD-31 child records | Guardian-managed minimum records, no child accounts |
| OD-32 assistance governance | District decisions; published criteria; public channel for non-members. Campaign rights not named yet |
| OD-33 scorecards | Quarterly, at least 10 cases, 10-working-day correction window |
| OD-34 promise validation | A second person with `promise.publish` approves |
| OD-35 live moderation | Moderators approve before a question is shown; no fixed delay |
| OD-37 election data | Election Commission publications only (M29 not built) |
| OD-38 field data | Concern categories and non-sensitive notes; 12 months |
| OD-42, OD-43, OD-44, OD-45 | Not built until decided |

## 10 Gate G2

The code side of Gate G2 is ready to verify: case time limits end to end, and row-level security tests. The rest of G2 is for the owner and the named roles:
- the legal opinion (DEP-03);
- the finance procedure;
- the neutrality audit and scorecard policy;
- the DPIA update and the penetration test;
- the one-district assistance pilot with partner NGOs;
- a quarter of internal scorecards;
- sign-off by the Sponsor, Tier 5, the DPO, Legal Counsel and the Treasurer.
