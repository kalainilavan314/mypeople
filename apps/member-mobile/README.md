# My People member app (Expo)

The Android and iOS member app (BRD §15A.4): React Native, Expo SDK 58, Expo Router, TypeScript. It replaces the PWA in `app/` once it reaches the same features.

**Status: shell.** The five permanent tabs (Home, Events, Card, Gallery, Profile) exist with the shared fonts, colours and Tamil/English text. Each tab says plainly that its feature is not built yet. Home also checks the connection to the API (`/v1/health`).

## Run

```powershell
copy .env.example .env.local      # EXPO_PUBLIC_API_URL: the public API address only
npm run web --workspace @my-people/member-mobile         # browser preview on http://localhost:8081
npm run android --workspace @my-people/member-mobile     # Expo Go or an emulator
```

Start the FastAPI service too (`docs/development/setup.md`). Anything in an `EXPO_PUBLIC_` variable is built into the app and readable by anyone, so never put a secret there.

## Check

```powershell
npx tsc --noEmit                                   # in this folder
npx expo install --check                           # versions match the Expo SDK
npx expo export --platform android --output-dir dist-android
npx expo export --platform web --output-dir dist-web
```

## Layout

```text
app/                 routes (Expo Router)
  _layout.tsx        loads the locked fonts and the i18n text
  (tabs)/            the five tabs
src/lib/             api.ts (shared API client), i18n.ts
assets/images/       app icon, splash and favicon (from the PWA)
```

Shared pieces come from `packages/`: `mobile-ui` (fonts, tab icons, shared screens), `design-tokens`, `i18n` and `api-client`. Feature code goes in `src/features/<feature>/` as each feature is built.

The icons are 512 px; the app stores need 1024 px versions before a store build. Bundle identifiers are set when store publishing is decided.
