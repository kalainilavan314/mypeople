# Membership, card, renewal and profile

The card is `app/(member)/(tabs)/card.tsx` (C01 to C06) and the profile screens are `app/(member)/(tabs)/profile.tsx` and `app/(member)/profile/` (P01 to P06).

**Status: M1.2 card continuity built; renewal and certificates not built yet.** The live card has a 60-second signed QR, a countdown and temporary brightness control. A saved card is an encrypted visual copy with a sync age, never an offline QR or proof of current status. C04 shares public text or a temporary PNG without identity numbers or the live QR; wallet passes await INT-03. C05 uses confirmed join, identity and event-attendance records without points or rankings; training completion needs a verified data source. Offline scanning awaits OD-08. Replacing a confirmed recovery number and starting authenticator enrolment now require the current password in the API. Passkeys, new-device verification and device file wipe await INT-02/INT-09.

BRD v1.1: FR-CARD-001 to 015 (C01 to C06), FR-RNW-001 to 009 (M33, M34), FR-PROF-001 to 019 (P01 to P06); §9.3 membership states (OD-02).
