# Member-app components

Components the member screens share: `AppText` (locked fonts on the type scale), `Screen`, `SurfaceCard`, `Button`, `TextField`, `SelectField`, `Checkbox`, `ChipRow`, `StatusTag`, `MenuRow`, `DateBadge`, `Notice`, `QueryView`, `QrCode`, `GalleryImage`. They follow the component contracts in `design/mobile/production-design-specification.md` §3. Components the staff app also needs move to `packages/mobile-ui`.

Control states use the `aria-*` props (`aria-checked`, `aria-selected`, `aria-disabled`, `aria-busy`): React Native Web 0.21 ignores `accessibilityState`.

BRD v1.1: BR-087 (status never by colour alone), BR-088 (honest empty states); NFR accessibility (WCAG 2.2 AA).
