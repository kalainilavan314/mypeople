# assistance module

Community Support / சமூக உதவி: confidential support cases, programmes with published criteria, and
partners, behind the political-neutrality firewall (BR-102 to 108).

**Status: support cases built** (Alembic 0038, behind the `community_support` switch): `/v1/assistance`
for M11 to M14 (members), a public web form for people without an account (`/public-form`,
`/public-requests`; the member app's `/help/support` page), S11 intake for the hotline and partners,
the S12 case file and D13 decisions, D14 programmes, criteria versions and partners, and statistics
with a minimum cell of 10: by area, category and state for staff, by district and category only for
everyone (`/statistics`).

- A schema of its own with row-level security: every row is invisible unless `repository.py` opens
  the firewall for its transaction, so no other module can read or join it.
- Only the assigned caseworker and the decision-makers open a case file; intake staff see only the
  summary of a case waiting for screening, to route it to a caseworker; every opening is audited.
  Nothing about membership, donations, events or campaigns is read or returned.
- Possible duplicates match the same phone, app account or name, never the household text alone.
- A decision cites the latest criteria version of an active programme that covers the case's kind of
  help.
- FR-AST-013 (no assistance decisions with fundraising or election-roster rights, in any area) is
  RB-12 in `app/modules/access/rules.py`.

- Consent again for each partner referral (M12, Alembic 0043): the caseworker proposes a partner and
  a purpose; an applicant with an app account agrees or refuses on their request, and nothing goes to
  the partner before that. For a request from the hotline, the public form or a partner, the
  caseworker records the consent the applicant gave them. No approved notification fits a waiting
  proposal yet, so the applicant sees it on their request rather than in a push.

Not built yet: disaster relief FR-DIS-001 to 008 (`/v1/alerts`, `/v1/relief`), Phase 3.
