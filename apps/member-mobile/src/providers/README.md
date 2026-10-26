# App-wide providers

`SessionProvider.tsx`: the stored session (SecureStore on phones; memory only in the web preview), sign-out, and the return to sign-in when a session ends elsewhere. The language is kept by `src/lib/i18n.ts`.

**Status: built (Batch 21).**

BRD v1.1: BR-001 (language chosen first and kept), FR-PROF-011 (instant language switch), FR-AUTH-025 (sessions).
