# Households Feature

D02 Member and household record (MP-FEA-002 §4.1; SC-22, PRM-33), read-only.

**Status: Built (Phase 2.5a SC-22; Phase 2 audit fixes, 13 November 2026)**

## Overview
- **Permission**: `household.view_for_case` (PRM-33) over the member's area and the household's area, and only when the household has given caseworker consent. Refusals (`outside_your_area`, `no_caseworker_consent`) are audited by the API and shown with their own Tamil and English words; a member without a shared household gets the same consent answer.
- **Read-only**: `services/api/app/core/permissions.py` has no household management permission, so staff cannot change household records here; the household corrects its own records in the app. Staff write actions wait for that permission to be decided.
- `actions.ts`: the member-ID lookup only redirects to the record page, so each opening is requested and logged once.
- `HouseholdDetailView.tsx`: household ID, District, DS and GN, the date caseworker access was given, and members (adults with their own age band and occupation, children with birth year). The household's change log is not shown to staff.
- **Pages**: `/members` (look up by member ID), `/members/[memberId]` and `/members/[memberId]/household` (the record).
