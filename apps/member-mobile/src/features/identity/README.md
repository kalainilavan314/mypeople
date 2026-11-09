# Identity documents, review and appeal

`pickImage.ts` (camera, or the phone's photos as the manual route, FR-VOI-007; `discardImage` removes the picker's cached copy), `PhotoRow.tsx` (one required image, its upload and the A17 interrupted state), `DecisionHistory.tsx`. The screen is `app/(member)/verify.tsx` (A04 to A12, A17): consent before upload (BR-008), the route's photos, the declaration and submission, what to correct, the history and one appeal. A picked photo is uploaded straight away. If the upload is interrupted, the row reads "Not yet received by the server" and keeps that one photo (in memory and the app's private cache, never the gallery or an offline outbox) so "Retry upload" sends it again; the cached copy is deleted once the server acknowledges it, or when it is replaced or the screen is left (FR-REG-034, 035, BR-020, BR-021).

**Status: built (Batch 21; A17 in Batch 1.1).** Not built: on-device capture-quality checks and OCR (Batch 1.3), the 10-working-day appeal target.

BRD v1.1: FR-REG-001 to 036, FR-IDV-001 to 017; screens A03 to A17, M01 to M05.
