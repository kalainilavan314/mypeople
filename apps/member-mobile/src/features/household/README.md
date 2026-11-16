# My Household Feature Logic

Shared pieces for the My Household screens (MP-FEA-002 §4.1, screens M06 to M10; BRD v1.1 FR-HH-001 to 010, BR-098 to BR-101).

**Status: Built (Phase 2.5a SC-22; Phase 2 audit fixes, 13 November 2026)**

- `labels.ts`: the age bands, occupation categories and child relationships the API accepts; who is an adult or a child; who may manage a child's record; place and relationship labels; first-name and birth-year checks matching the API.
- `MyDetailsCard.tsx`: an adult's own age band and occupation (OD-30).
- `CaseworkerConsentCard.tsx`: caseworker access, given by the head and withdrawn by any adult.
- `HouseholdHistory.tsx`: the household's change log (what, who, when).
