# assistance module

Community Support / சமூக உதவி: confidential support cases, programmes with published criteria, and
partners, behind the political-neutrality firewall (BR-102 to 108).

**Status: support cases built** (Alembic 0038, behind the `community_support` switch): `/v1/assistance`
for M11 to M14 (members), a public form for people without an account, S11 intake for the hotline
and partners, the S12 case file and D13 decisions, D14 programmes, criteria versions and partners,
and statistics with a minimum cell of 10.

- A schema of its own with row-level security: every row is invisible unless `repository.py` opens
  the firewall for its transaction, so no other module can read or join it.
- Only the assigned caseworker and the decision-makers open a case; intake staff only while it waits
  for screening; every opening is audited. Nothing about membership, donations, events or campaigns
  is read or returned.

Not built yet: disaster relief FR-DIS-001 to 008 (`/v1/alerts`, `/v1/relief`), Phase 3.
