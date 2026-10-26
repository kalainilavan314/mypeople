# Sign-in, recovery and sessions

The ID-number fields shared by sign-in, registration and recovery (`IdRouteFields.tsx`: NIC, or passport number and issuing country). The screens are in `app/(auth)/`; the stored session is in `src/providers/SessionProvider.tsx` and `src/lib/storage.ts`.

**Status: built (Batch 21):** welcome and language (A01), sign-in (A02), registration (A03), recovery by code (A13) and assisted recovery (A16). Session list and password change are in `app/(member)/profile/security.tsx`. Not built: passkeys, step-up codes and the staff second factor in this app (FR-AUTH-018, 022, 025).

BRD v1.1: FR-AUTH-001 to 027; screens A01, A02, A16, A18, M49, M50.
