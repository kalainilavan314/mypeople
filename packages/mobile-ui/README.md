# @my-people/mobile-ui

What the member and staff Expo apps share:

- the locked fonts (`lockedFonts`, `fontFamilyFor`, `textStyle`, `monoFontFamily`; see `CLAUDE.md`);
- the screen components from `design/mobile/production-design-specification.md` §3: `AppText`, `Screen`, `SurfaceCard`, `Button`, `TextField`, `SelectField`, `Checkbox`, `ChipRow`, `StatusTag`, `MenuRow`, `DateBadge`, `Notice`, `QueryView`, `QrCode`, `AuthorizedImage`;
- the stored session: `SessionProvider` (token in SecureStore on phones, memory only in a web preview), `api()`, and the storage helpers;
- data hooks: `useApiQuery`, `useApiAction` (an ended session returns to sign-in; other 401s such as a wrong password do not), `useRotatingCode`, `useReloadOnFocus`, `useLanguage`;
- dates and times in Asia/Colombo.

Each app keeps its own text (`src/i18n`) and passes its own error words to `QueryView`. Control states use `aria-*` props, which React Native Web 0.21 needs.

`npm run typecheck --workspace @my-people/mobile-ui`
