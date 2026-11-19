# Renewal and certificates

M33 is `app/(member)/renewal/index.tsx`; M34 is `app/(member)/renewal/certificates.tsx` and one certificate is `app/(member)/renewal/certificate/[id].tsx`. The public check a certificate's QR opens is `app/certificate/[token].tsx` (https://app.tmk.lk/certificate/<code>), open without signing in. The card tab offers both rows while the `renewal` module is on (`useRenewalOpen.ts`), and a lapsed member gets "Renew my membership" there.

`certificateText.ts` holds a certificate's words in Tamil and English (a certificate is shown to others, so it carries both, Tamil first). `CertificateDocument.tsx` draws it in the app's locked fonts with the party's red and gold and the verification QR. `saveCertificate.ts` turns it into a PDF: on a phone the on-screen document is photographed (`react-native-view-shot`) and handed to the share sheet; in a browser `webCertificate.ts` draws the same words on a canvas and downloads it. `certificatePdf.ts` wraps the JPEG in a one-page A4-width PDF without a PDF library.

**Status: built (Phase 3 renewal batch), behind the `renewal` switch.** Renewal asks only for the mobile number and the area (BR-136): a changed number goes through the code-checked recovery-number screen, a changed area through the area-change request. A certificate never shows an NIC or passport number; a revoked or replaced one is shown but not offered for download.

BRD v1.1: FR-RNW-001 to 009, BR-136, BR-137, OD-43, INT-22; screens M33, M34, D25.
