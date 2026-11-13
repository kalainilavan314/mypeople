# Households Module

Voluntary family and household management module with PostgreSQL Row-Level Security (RLS) isolation (BRD §15A.7 "household", Phase 2.5a SC-22).

**Status: Built (Phase 2.5a — SC-22)**

## Business Rules & Governance
- **BR-098**: Strictly voluntary participation. Sharing household data is never a requirement for any party service or membership status.
- **BR-099**: Adult members require explicit mutual consent; an invitation must be explicitly accepted before membership linkage.
- **BR-100**: Single active household per member; an individual can belong to at most one active household at any time.
- **BR-101**: Purpose separation & RLS isolation. Household data is stored in the dedicated `household` schema and strictly isolated using PostgreSQL Row-Level Security (`household.household`, `household.household_member`, `household.invitation`, `household.consent_log`). It is never joined with election, survey, or political profiling records.
- Minor/dependent records are intentionally deferred until POL-06 is approved and its safeguarding, retention, and consent rules are implemented.
- **PRM-33**: Staff operational view (`household.view_for_case`) allows caseworkers to view a household file only for members within their permitted geographic area assignment. Every staff view is audited and logged in `consent_log`.

## API Endpoints
Base path: `/v1/households` (Gated by Feature Flag `households` / G2).
- `GET /mine`: View current member's active household.
- `POST /`: Create a new household (creator becomes head).
- `PATCH /mine`: Update household metadata (head only).
- `GET /invitations/mine`: List received and sent invitations.
- `POST /invitations`: Send an invitation to an adult member (head only).
- `POST /invitations/{id}/respond`: Accept or decline an invitation.
- `POST /invitations/{id}/revoke`: Revoke a pending invitation (inviter or head).
- `POST /members/{id}/remove`: Remove a member (head only; head removal dissolves household).
- `POST /leave`: Voluntarily withdraw consent and leave (dissolves if head).
- `GET /privacy`: Legal and data protection privacy notice.
- `GET /staff/{target}`: Operational read-only view for caseworkers holding `household.view_for_case` (PRM-33) within permitted area.
