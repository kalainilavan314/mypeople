# Home reference design

Home and its dashboard feature cards follow the user's uploaded three-screen MedTech reference. Changes are scoped to `features/home/`, `core/theme/home.css` and Home-specific shell selectors. Events, Card, Gallery, Profile, authentication and the shared navigation component were not edited for this redesign.

## Visual system

| Purpose | Value |
| --- | --- |
| Canvas | `#F4F6FA` |
| Cards | `#FFFFFF` |
| Navy anchor | `#0B2443` |
| Hero | subtle `#061A33` to `#132B48` navy shading |
| Primary text | `#172439` |
| Secondary text | `#596A81` |
| Activity overview | pale blue `#DBE7FC` to `#EEF3FB` |
| Hairlines | `#E7ECF3` |

Use self-hosted Inter and Noto Sans Tamil throughout Home. The previous English serif headline is removed. Greeting names are 18px semibold, the English hero headline 23px semibold, section headings 14px, feature names 13px and brief captions 10–11px. Tamil has natural letter spacing and increased line height.

Mobile gutters are 16px. Major sections use 14px gaps and 18–22px radii, matching the rounded reference. Quick-action symbols sit in 40px circular wells. Their whole tiles remain at least 44px wide with 80px minimum height. Photo cards and stat tiles use the whole card as their touch target.

## Content and components

```text
HomeScreen
├── HomeHeader          real member name/avatar/location, notifications, feature search
├── CommunityHero       short mission headline, illustrative community photo, Get Involved
├── ActivityOverview    existing event/report/referral data; aligned numeric baselines
├── HomeServices
│   ├── Quick access    Volunteer, Surveys, Report issue, Events, Community
│   └── Feature cards   Party Fund, My area, Ideas, Courses, Referrals, Gallery, Card
├── NearbyEvents        upcoming API events or an honest empty state
└── Footer
```

Keep English descriptions to a few words. Tamil labels are shortened without removing feature entry points. The mission reads “Build our North. Together.”, with “Your voice matters.” below. All links keep their existing destinations. Search filters both feature groups in English or Tamil.

Activity metrics use existing query results and actual member recruit counts. Unavailable data displays an em dash. No fabricated ratings, medical content, statistics, profile photos or filter controls are added.

The community hero uses a generated illustrative photograph of neighbours working together, fitted to the previous card dimensions with a navy text overlay. Its prompt and original asset are recorded in `docs/assets/community-hero.md`. Local updates, courses and gallery use existing licensed Nallur/library/fields photographs. Those cards link to existing features and are identified as illustrative, with gallery credits available below.

## Scope and accessibility

Home's active navigation icon uses a navy pill with a white glyph; its label is navy. The CSS requires `.member-shell--home`, so entering another tab restores that tab's existing styling. The shared five-destination navigation and `/card?qr=1` behaviour remain unchanged.

The existing measured navigation clearance and safe-area support remain in effect. Keyboard focus rings and accessible names are retained. Transitions last 180ms and respect reduced motion. Tamil quick actions wrap into fewer columns where needed; activity values remain aligned across different label lengths.

## Verification

The production TypeScript/Vite/PWA build and `scripts/verify-home.mjs` validate English/Tamil layouts at 320, 375, 390, 768 and 1280 pixels, long names, search, icon/stat alignment, touch targets, footer clearance, photo loading and Card QR entry. The test confirms that Card navigation restores the existing colour outside Home.

`docs/refactor/home-protected-baseline.json` records source fingerprints for the excluded sections, authentication, root router and shared navigation styles/component. All 108 protected source files remained unchanged during this redesign. Screenshots use local fixture data and do not contact production.
