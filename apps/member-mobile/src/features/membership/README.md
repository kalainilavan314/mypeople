# Membership, card, renewal and profile

The card is `app/(member)/(tabs)/card.tsx` (C01 to C06) and the profile screens are `app/(member)/(tabs)/profile.tsx` and `app/(member)/profile/` (P01 to P06).

**Status: card and profile built (Batch 21); C02, C04 sharing and C05 added in the Puvi branch; C03 offline card added in Batch 1.1; renewal and certificates not built yet.** The card is a plain navy credential with a 60-second QR. C04 supports sharing the member's name and code as informational text only; the live QR and private identity data never leave the card screen. Image/PDF exports and wallet passes remain pending (INT-03, OD-06). Native QR brightness control and step-up/passkey security remain M1.2 work.

C03: `savedCard.ts` keeps the display fields of the last card the server confirmed, with that time, in the keychain or keystore (never a QR code, BR-066), and removes them whenever the card is no longer available; sign-out and the end of a session remove them too (`clearSession` in `packages/mobile-ui`, FR-PROF-016). `OfflineCard.tsx` shows that copy with "Offline — last updated …" and "Online check needed" on the card tab while the server cannot be reached (retrying every 30 seconds) and on the welcome screen when the app opens offline. `MemberCardView.tsx` is the card itself, shared by both. An offline signed credential waits on OD-08; the app has no queued actions, so there is nothing to sync on reconnection (FR-CARD-009 part).

BRD v1.1: FR-CARD-001 to 015 (C01 to C06), FR-RNW-001 to 009 (M33, M34), FR-PROF-001 to 019 (P01 to P06); §9.3 membership states (OD-02).
