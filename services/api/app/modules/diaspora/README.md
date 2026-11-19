# diaspora module

Overseas supporters (BRD v1.1 §11.39, M46, FR-DSP-001 to 006, BR-147, ENT-59): `/v1/diaspora`.

**Status: built (Alembic 0047), behind the `diaspora` switch (Phase 3, gate G3).**

- Registration with country of residence, time zone, contact topics and skills, kept with consent until the supporter deletes it; separate from identity verification and membership, with no contribution rights (FR-DSP-001, BR-147).
- International events: staff with events.manage over an event's area list it for supporters abroad; supporters see the time in Sri Lanka and in their own time zone, converted on the server (FR-DSP-002), and are notified if they asked.
- Remote, skill-based volunteering reuses volunteering (`engagement.volunteer_opportunity.remote`, FR-DSP-003).
- Development proposals for the home area reuse proposals; a registered supporter's proposal is tagged in `diaspora.proposal_tag` for aggregate counts only, with no member id (FR-DSP-004).
- Networking happens only inside approved diaspora committees, which follow committee rules (FR-DSP-005).
- Foreign and cross-border contributions stay off (`rules.FOREIGN_CONTRIBUTIONS_ENABLED = False`, OD-40, OS-16): the party fund refuses a registered supporter's contribution with `foreign_contributions_disabled` (FR-DSP-006). There is no payment route.
- Staff see counts by country, topic and proposal stage only, small numbers hidden (analytics.view over the platform).
