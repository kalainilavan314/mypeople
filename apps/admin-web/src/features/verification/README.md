# Identity verification

The verification queue (W01, `app/(staff)/verification`), the identity decision screen with evidence, checklist and decisions (W02, `verification/[id]`), the screening notice (D03), duplicate investigations (D04, `app/(staff)/duplicates`) and appeals (D05, `app/(staff)/appeals`). `actions.ts` claims, releases, decides and reports a duplicate; `caseActions.ts` and `CaseControls.tsx` claim and decide appeals and investigations. Images open through `app/evidence/[documentId]/route.ts`.

**Status: built (Batch 22).** Not built: screening results (D03 shows "No screening" until the AI worker exists, OD-42, OD-28), the evidence watermark (FR-WEB-006), the 10-working-day appeal target.

BRD v1.1: FR-WEB-001 to 013, FR-IDV-010 to 013; screens W01, W02, D03 to D05.
