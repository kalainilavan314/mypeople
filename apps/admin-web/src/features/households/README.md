# Households Feature

Caseworker operational lookup for voluntary household records under permitted scope (Screen D02, Phase 2.5a SC-22).

**Status: Built (Phase 2.5a — SC-22)**

## Overview
- **Permission**: `household.view_for_case` (PRM-33) with area-scoped access control.
- **Components**:
  - `actions.ts`: Server actions for member code lookup.
  - `HouseholdDetailView.tsx`: Displays target member, household details, active members with roles and relationships, and consent audit logs.
- **Pages**:
  - `/members`: Search members by member code or ID.
  - `/members/[memberId]`: Operational household view for the specified member.
  - `/members/[memberId]/household`: Canonical household view route.
