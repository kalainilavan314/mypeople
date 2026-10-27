# My People member app (Expo)

The Android and iOS member app (BRD §15A.4): React Native, Expo SDK 58, Expo Router, TypeScript, on the FastAPI `/v1` API. It replaces the PWA in `app/` once it reaches the same features and FastAPI is deployed.

**Status: member screens built (Batch 21), following the approved PWA designs (`design/mobile/production-design-specification.md`):**

| Area | Screens |
|---|---|
| Before sign-in | A01 welcome and language, A02 sign-in (NIC or passport), A03 registration in three steps, A13 recovery by code, A16 assisted recovery |
| Identity | A04 to A12 in one screen: consent, the route's photos (camera, or the phone's photos), declaration and submission, corrections, history, appeal |
| Home | H01 and H02 (the server decides), H03 notifications with Action needed, H04 community hub; locked and unbuilt services say so |
| Events | E01 list with My area, This week, This month and search; E02 to E05 detail and answer; E06 pass with a 60-second QR |
| Card | C01 card with a 60-second QR, C06 why it is not available |
| Gallery | G01 albums, G02 album, G03 photo with previous and next and a removal request with its receipt |
| Profile | P01 profile, edit (display name and gender; legal details locked), My activity, My area and area change with proof, language and notification choices with quiet hours, recovery number, signed-in devices and password change, privacy (identity-data notice, copy and closure requests) |

Not built yet: the ID-card artwork, PDF, wallet and sharing on the Card tab; the events map; push registration (no FCM or APNs credentials, INT-02); the optional survey; services the hub lists as not available yet. Tamil text in `src/i18n/ta.ts` is new and needs a Tamil speaker's review before release.

## Run

```powershell
copy .env.example .env.local      # EXPO_PUBLIC_API_URL: the public API address only
npm run web --workspace @my-people/member-mobile         # browser preview on http://localhost:8081
npm run android --workspace @my-people/member-mobile     # Expo Go or an emulator
```

Start the FastAPI service too (`docs/development/setup.md`). Anything in an `EXPO_PUBLIC_` variable is built into the app and readable by anyone, so never put a secret there.

The session token is kept in the phone's keychain or keystore (expo-secure-store). The web preview has no secure store, so it keeps the token in memory only: reloading the page signs out.

## Check

```powershell
npx tsc --noEmit                                   # in this folder
npx expo install --check                           # versions match the Expo SDK
npx expo export --platform android --output-dir dist-android
npx expo export --platform web --output-dir dist-web
```

`npx expo start` writes the typed routes to `.expo/types/router.d.ts`; with that file present, `tsc` also checks every link.

## Layout

```text
app/
  _layout.tsx          fonts, saved language, session; signed-in and signed-out routes
  (auth)/              welcome, sign-in, register, recover, assisted-recovery
  (member)/            everything that needs a session
    (tabs)/            Home, Events, Card, Gallery, Profile
    verify.tsx, notifications.tsx, hub.tsx
    events/[id].tsx, events/[id]/pass.tsx
    gallery/[id].tsx, gallery/photo.tsx
    profile/           edit, activity, area, settings, security, privacy, recovery-number
src/
  components/          GalleryImage, QueryView (with this app's error words)
  features/            auth, area, events, home, identity
  i18n/                this app's Tamil and English text (en.ts, ta.ts)
  lib/                 API address, language, error messages
assets/images/         app icon, splash and favicon (from the PWA)
```

Shared pieces come from `packages/`: `mobile-ui` (locked fonts, the screen components of spec §3, the stored session, the data hooks, formats in Asia/Colombo), `design-tokens`, `i18n` (the PWA's text) and `api-client`.

The icons are 512 px; the app stores need 1024 px versions before a store build. Bundle identifiers are set when store publishing is decided.
