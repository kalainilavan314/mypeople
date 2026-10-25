# Home reference design

Home and its dashboard feature cards follow the user's uploaded three-screen MedTech reference. The latest update adds images to all six requested Home service cards and replaces the shared navigation with the user's raised centre QR reference. Profile now follows the separately supplied centred account layout; see `profile-design.md`. Events, the restored detailed Card and Gallery content remain preserved, as do sign-in and registration.

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
│   ├── Quick access    Volunteer, Surveys, Report issue, Community
│   └── Feature cards   Party Fund, My area, Ideas, Courses, Referrals, Gallery, Card
├── NearbyEvents        upcoming API events or an honest empty state
└── Footer
```

Keep English descriptions to a few words. Tamil labels are shortened without removing feature entry points. The mission reads “Build our North. Together.”, with “Your voice matters.” below. All links keep their existing destinations. Search filters both feature groups in English or Tamil.

Activity metrics use existing query results and actual member recruit counts. Unavailable data displays an em dash. No fabricated ratings, medical content, statistics, profile photos or filter controls are added.

The community hero uses a generated illustrative photograph of neighbours working together, fitted to the previous card dimensions with a navy text overlay. Its prompt and original asset are recorded in `docs/assets/community-hero.md`. My area, courses and gallery use existing licensed Nallur/library/fields photographs. Ideas uses a new collaboration/notebook photograph; Invite people uses the community photo; Membership card uses a new blank navy-card product photograph without identity data. New images and prompts are recorded in `docs/assets/home-services.md`. All six cards keep their feature routes and short descriptions. These photos illustrate the services rather than document actual movement events.

## Scope and accessibility

The shared five-destination navigation uses a floating white bar, pale active-tab surface, navy labels and a 64px raised navy centre circle with a white scanning icon. The centre action retains `/card?qr=1`. All label baselines align; the four ordinary icons share a baseline. Navigation clearance measures the raised circle as well as the bar so scrolling content stays accessible above it.

The existing measured navigation clearance and safe-area support remain in effect. Keyboard focus rings and accessible names are retained. Transitions last 180ms and respect reduced motion. Tamil quick actions wrap into fewer columns where needed; activity values remain aligned across different label lengths.

## Verification

The production TypeScript/Vite/PWA build and `scripts/verify-home.mjs` validate English/Tamil layouts at 320, 375, 390, 768 and 1280 pixels, long names, search, ordinary-icon/label/stat alignment, raised centre styling, touch targets, footer clearance, all six photo cards and Card QR entry.

`docs/refactor/home-protected-baseline.json` records the earlier Home-only change's 108 protected source fingerprints. Profile and shared navigation are intentionally changed by the subsequent user request. Screenshots use fixture data; verification scripts can target a local production preview or deployed assets without updating member data.
