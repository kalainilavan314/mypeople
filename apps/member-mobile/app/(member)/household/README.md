# My Household Screens

The member's voluntary household screens in the Expo app (MP-FEA-002 §4.1; BRD v1.1 SC-22, FR-HH-001 to 010).

**Status: Built (Phase 2.5a SC-22; Phase 2 audit fixes, 13 November 2026)**

## Screens
- **M06** (`index.tsx`): the household with its household ID and District, DS and GN; adults (name, relationship, age band and occupation when set) and children (first name, relationship, birth year, guardian). The head corrects adults' relationships and removes adults; the guardian or head edits and deletes a child's record; each adult sets their own details (`MyDetailsCard`). Leaving: the head of a household with other adults hands over to the adult who joined first; the last adult ends the household.
- **M07** (`add.tsx`): add or correct a child (`?id=` to correct): first name, relationship and birth year only, with the adult as guardian (OD-31). Adults are never added here.
- **M08** (`invite.tsx`): invite an adult by member code (neutral confirmation, no name) or share an invitation through the share sheet, in Tamil and English, naming only the household.
- **M09** (`invitations.tsx`): accept or decline received invitations (accepting needs a verified identity); the head sees sent invitations by member code only and can withdraw them.
- **M10** (`privacy.tsx`): the privacy notice, caseworker access (given by the head, withdrawn by any adult), the household's change history, and leaving.
