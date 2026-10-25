# My People staff app (Expo)

The coordinators' and caseworkers' app (BRD §11.30, screens S01–S18). It is a separate app from the member app, as BRD §15A.5 recommends, so the public member app carries no staff features. Open decision OD-26 confirms that choice. It shares `packages/` with the member app.

**Status: shell.** The tabs Home, Tasks, Cases, Check-in and Profile exist; each says that its feature is not built yet, and Home checks the connection to the API. The labels Tasks, Cases and Check-in are new, and their Tamil text (`src/lib/i18n.ts`) needs review by a Tamil speaker.

Before staff features are built, the BRD requires: MFA for every staff sign-in, managed or registered devices with remote wipe (FR-STF-010), screenshot blocking on evidence views, and an encrypted local store for offline field data. Permissions are always checked by the API, never only in this app.

## Run

```powershell
copy .env.example .env.local      # EXPO_PUBLIC_API_URL: the public API address only
npm run web --workspace @my-people/staff-mobile          # browser preview on http://localhost:8082 (use --port 8082)
npm run android --workspace @my-people/staff-mobile
```

The checks and layout are the same as the member app (`apps/member-mobile/README.md`).
