# Sign-in, recovery and sessions

The ID-number fields are shared by sign-in, registration and recovery (`IdRouteFields.tsx`: NIC, or passport number and issuing country). The screens are in `app/(auth)/`; the stored session is shared with the staff app in `packages/mobile-ui/src/session/SessionProvider.tsx` and `packages/mobile-ui/src/lib/storage.ts`.

**Status: built (Batch 21 and M1.2):** welcome and language (A01), sign-in (A02), registration (A03), recovery by code (A13) and assisted recovery (A16). Session list, confirmed remote revocation, security alerts and password change are in `app/(member)/profile/security.tsx`. Revocation ends API access on the device's next request; it does not erase local files. The API requires the current password before replacing a confirmed recovery number or starting authenticator enrolment. Passkeys and new-device step-up codes await INT-02/INT-09. Staff second-factor verification lives in the staff app.

BRD v1.1: FR-AUTH-001 to 027; screens A01, A02, A16, A18, M49, M50.
