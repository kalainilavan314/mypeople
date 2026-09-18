# NorthUnity member experience

## Implemented in this revision
- Institutional palette: navy #14263D, slate #526A82, mist #F4F6F8, white surfaces. Forest/amber/red indicate outcomes.
- Inter for English; Noto Sans Tamil retained. 8px spacing rhythm; 10–14px cards; restrained shadows.
- Home uses the signed-in member's registered area, personal community reports, and published future events. No fabricated province-wide metrics.
- Navigation: Home / Community / Action / Activity / Me. All previous routes remain available through hubs or Profile.
- Central action dialog uses native modal focus handling and Escape dismissal. Only implemented member actions are offered.
- My Area resolves the member's GN reference from the existing administrative registry.
- Profile uses connected report, referral and RSVP counts; decorative particles and continuous pulse removed.
- Shared failed-query states now have a working retry button.

## Existing capabilities and data boundaries
Backend: member profile and image storage, membership identity, events and RSVP, personal community reports, donations and administrative donation review.
Prototype modules remain: ideas, surveys, learning, skills and some other content still come through the mock adapter. Do not interpret their sample counts as organisational statistics. Community labels demonstration content; Home no longer aggregates it.
Card payments remain a sandbox/configuration-dependent capability, not a live payment integration. This design revision does not change payment processing or access rights.

## Subsequent product work from the design brief
Area-wide analytics need authorised aggregate endpoints and agreed definitions. Do not publish a Pulse score until each input and formula is documented.
Projects, budgets and milestones require schemas, audit records and scoped financial permissions.
Volunteer availability requires opt-in records and operational matching, not political inference.
Expanded geographic roles, admin MFA, session revocation and audit retention require a separate backend/security implementation.
Field mode requires scoped assignments, offline data expiry and conflict-aware sync.
An organisational assistant must enforce those same permissions and cite source records.

## Acceptance checks
TypeScript and production build; browser review of Home, Community, My Area, quick actions, profile and reduced mobile layouts. Existing data is not rewritten by this UI revision.
