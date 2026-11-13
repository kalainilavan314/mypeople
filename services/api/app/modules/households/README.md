# Households Module

My Household: a voluntary family record (MP-FEA-002 §4.1, screens M06 to M10 and D02; BRD v1.1 FR-HH-001 to 010, BR-098 to 101, PRM-33). It never blocks identity, membership, events or assistance.

**Status: Built (Phase 2.5a SC-22; Phase 2 audit fixes on 13 November 2026). Behind the `households` switch (G2).**

## Rules
- **M06**: one household per identity-verified member (`identity_not_verified` otherwise, for creating and for accepting). The household keeps the creator's area (`area_key`, `area_path` from `member_area_path`) and shows a short household ID (`HH-` and the first 8 hex digits of its id) with its District, DS and GN names. Anyone can leave at any time. When the head leaves, the adult who joined first becomes head (logged as `update_member`, `{"change": "became_head"}`); the household ends only when no adult remains.
- **M07 / OD-31 (children)**: a child is a guardian-managed minimum record: first name (no digits), relationship (`child`, `grandchild`, `sibling`, `other`), birth year (under 18) and the guardian. Any verified confirmed adult of the household adds one and becomes its guardian; the guardian or the head corrects or deletes it. No account, photo, ID number or phone: unknown fields are refused (`422`). A guardian who leaves takes their children's records with them.
- **M07 / OD-30 (adults)**: adults are never added by someone else; they join only by accepting their own invitation (M08, M09). Each adult sets only their own age band and occupation category.
- **M08**: the head invites by member code; the answer is a neutral confirmation, and the sent list shows the code only, never the invitee's name before they accept. Whether the invitee is already in a household is not revealed (accepting refuses it). The app also offers a share-sheet message in Tamil and English naming only the household.
- **M09**: the invitee accepts or declines; the relationship is recorded only when they accept.
- **M10**: the household's confirmed adults read its change log (`GET /mine/log`: action, who and when; a caseworker is never named and someone who left is a former member). Corrections: the head corrects adults' relationships, each adult their own details, guardians (and the head) their children. Every change is logged in `household.consent_log` with ids and field names only, never names. When someone leaves, their stored name and details are erased; when the household ends, children's records are deleted, stored names and the household name are erased, consent and pending invitations end, and the log stays without names.
- **Caseworker consent (OD-30, consent per purpose)**: household data is visible only to its confirmed adults and, with recorded consent, to a caseworker. The head gives it (`only_head_can_give_consent` otherwise); any confirmed adult withdraws it; it also ends when the adult who gave it leaves. Stored in `household.caseworker_consent_at` / `_by`, logged, and audited (`household.caseworker_consent_given` / `_withdrawn`).
- **BR-101**: household data stays in the `household` schema under row-level security (Alembic 0021, 0042). It is never joined with membership, finance, election or campaign data and never used for political, campaign or fundraising work.

## Row-level security
Every request sets `app.current_member_id` for its transaction, so the database hides other households. A few writes the policies cannot express run with `app.bypass_rls` for the one statement block, only after the service has checked the rule, and scoped by id (`repository.system_access`): an invitee reading the name of a household that invited them and adding their own row when they accept; the head handing over; a guardian who is not the head deleting a child's record; a non-head adult withdrawing caseworker consent; the household ending. `tests/test_households.py` runs the whole flow through the API as a non-superuser role (`test_rls_full_household_flow_through_the_api`).

Known policy gap (needs a migration, not made here): the 0021 policies still let the household's creator read and update the household row after they have left (`created_by = current_member_id()`). The service never does this, but the policy should check active headship only.

## D02 staff view
`GET /staff/{member id or code}` needs `household.view_for_case` (PRM-33) over the member's area and over the household's area, and the household's caseworker consent. Refusals (`outside_your_area`, `no_caseworker_consent`) are audited as `access.denied`; a member without a household gets the same `no_caseworker_consent` answer, so a caseworker learns nothing without consent. Each opening is written to the household's log (`staff_view`) and the audit log (`household.view`). The view is **read-only**: `app/core/permissions.py` has no household management permission (only `household.view_for_case`), so D02's "manage member and household records" has no staff write actions until such a permission is decided; the household corrects its own records in the app.

## API Endpoints
Base path: `/v1/households`.
- `GET /mine`: the member's active household, with `householdCode`, `places`, `caseworkerConsentAt`, members (adults and children).
- `POST /`: create (verified members only; creator becomes head).
- `PATCH /mine`: rename (head only).
- `GET /mine/log`: the change log for the household's adults.
- `POST /mine/caseworker-consent`, `DELETE /mine/caseworker-consent`: give (head) or withdraw (any adult).
- `GET /invitations/mine`: received (with household name) and sent (member code only).
- `POST /invitations`: invite an adult (head only); neutral `{id, relationship, status, expiresAt}`.
- `POST /invitations/{id}/respond`: accept (verified only) or decline.
- `POST /invitations/{id}/revoke`: withdraw a pending invitation (inviter or head).
- `PATCH /members/me`: the adult's own `ageBand` and `occupationCategory` (null clears).
- `PATCH /members/{record id}`: the head corrects an adult's relationship.
- `POST /members/{record id}/remove`: the head removes an adult, or anyone removes themselves.
- `POST /dependants`, `PATCH /dependants/{record id}`, `DELETE /dependants/{record id}`: children's records.
- `POST /leave`: leave (head hands over, or the household ends when no adult remains).
- `GET /privacy`: the privacy notice.
- `GET /staff/{target}`: D02, as above.
