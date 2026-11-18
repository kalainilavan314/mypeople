# Mobile app: monochrome redesign (18 November 2026)

On 18 November 2026 the owner asked for a calm, monochrome redesign of the Expo app, for both members and the Staff section:

- white, black and neutral grey, with no red, yellow or gold as interface accents;
- exactly four bottom tabs: Home, Events, Card, Gallery;
- a white top bar with profile, logo and notifications;
- more balanced Tamil typography.

No feature, route, API, permission or data rule changed. This file is the design system and the screen inventory the request asked for.

## What the app has

- **Framework:** Expo SDK 58 with Expo Router; React Native Web serves app.tmk.lk.
- **Screens:** 90 route screens and 7 layouts, counted from `apps/member-mobile/app`. The BRD lists 69 baseline screens; this inventory counts the app's own routes.
- **Styling:**
  - Colours, sizes and corners come from `@my-people/design-tokens/mobile`, and the shared components live in `packages/mobile-ui`.
  - Nearly every screen already used them, so the new palette restyles all 90 screens.
  - The screens with their own colours or font sizes were rebuilt by hand: Puvi's Home, hub, profile, settings, privacy and security screens, and the membership card.
- **Fonts:** unchanged and locked (CLAUDE.md): Outfit for English, Noto Sans Tamil for Tamil, JetBrains Mono for IDs.
- **The admin dashboard and the member PWA** keep the root palette (`@my-people/design-tokens`). Only the Expo app's `/mobile` entry is monochrome.

## Design system

| Token | Value | Use |
|---|---|---|
| `page` | `#fafafa` | Screen background |
| `card` | `#ffffff` | Cards, top bar, tab bar |
| `text` | `#171717` | Main text, open tab, icons |
| `textSecondary`, `textMuted` | `#5f5f5f`, `#6e6e6e` | Secondary and quiet text (AA on the page, cards and grey surfaces) |
| `primary` | `#202020` | Primary buttons (white text, 16:1) |
| `selected`, `onSelected` | `#171717`, `#ffffff` | The chosen chip, language or option |
| `surfaceVariant`, `primaryContainer` | `#f4f4f5` | Quiet surfaces and icon tiles |
| `border`, `divider`, `inputBorder` | `#e7e7e7`, `#efefef`, `#c7c7c7` | Card edges, row dividers, inputs |
| `iconInactive` | `#777777` | Tab icons that are not open |
| `success`, `warning`, `error` | green, amber, red | States only, always with an icon and a label |

- **Spacing:** 4, 8, 12, 16, 20, 24, 32; the screen gutter is 16.
- **Corners:** tags 6, buttons and inputs 12, cards 14, sheets 20.
- **Heights:** buttons and inputs 50, every touch target at least 48, and the tab bar 72 plus the safe area.
- **Type scale, English / Tamil:**

  | Step | English | Tamil |
  |---|---|---|
  | Page | 24 | 22 |
  | Section | 18 | 17 |
  | Card title | 16 | 15 |
  | Body | 16 | 15 |
  | Secondary | 14 | 14 |
  | Caption | 12 | 12 |
  | Tab label | 12 | 12 |

  Tamil line height is about 1.6, so vowel signs are never clipped.
- **Shared pieces added:**
  - `ToggleSwitch`: the charcoal on/off switch.
  - `SectionHeader`: a heading with an optional "See all".
  - `FeatureRow`: the Home quick actions and hub services.
  - `tabLabel`: tab labels that never cut Tamil short.
- **Navigation:**
  - **Member tabs:** exactly Home, Events, Card and Gallery. Icons are outlined, charcoal for the open tab and grey for the rest.
  - **Top bar:** white with a hairline below; profile on the left, logo and name in the centre, notifications on the right. The unread dot is charcoal.
  - **Nested screens:** a back arrow and a centred title on the page colour.
  - **Staff section:** keeps its own five tabs (tasks, check-in, approvals, alerts, role), restyled the same way. They are separate destinations behind the authenticator code, not the member navigation.

## Tamil

- **A more compact scale:** Noto Sans Tamil draws larger than Outfit at the same size, so the app has its own Tamil scale. It is one step more compact than English (never below 12), with about 1.6 line height. Only the sizes change: no transforms, squeezed letters or negative spacing.
- **Fixed sizes removed:** the custom screens' fixed font sizes are gone (26 to 34 px headings, 17 px titles), so the Tamil scale applies everywhere. "வரவேற்கிறோம்!" no longer breaks mid-word at phone width.
- **Selectors:** the segmented control's options wrap to two lines instead of ending in "…", for example "எனது பிரிவு" and "அடையாளம்" on the issue report.
- **Tab labels:** they get the full tab width and their full line height, so "நிகழ்வுகள்" and "முகப்பு" are whole on a 320 px phone.

## Screens

| Route | File | Module | Who | What changed | Checked in the browser |
|---|---|---|---|---|---|
| `/assisted-recovery` | `apps/member-mobile/app/(auth)/assisted-recovery.tsx` | Sign-in and registration | Anyone | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/recover` | `apps/member-mobile/app/(auth)/recover.tsx` | Sign-in and registration | Anyone | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/register` | `apps/member-mobile/app/(auth)/register.tsx` | Sign-in and registration | Anyone | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/sign-in` | `apps/member-mobile/app/(auth)/sign-in.tsx` | Sign-in and registration | Anyone | Shared design system: monochrome tokens, Tamil type scale, shared components | EN and TA, 375 and 320 |
| `/welcome` | `apps/member-mobile/app/(auth)/welcome.tsx` | Sign-in and registration | Anyone | Chosen language in charcoal (selected token) | EN 375 |
| `/card` | `apps/member-mobile/app/(member)/(tabs)/card.tsx` | Membership card | Member | Monochrome card; card options use the shared rows | EN 375; TA 320 |
| `/events` | `apps/member-mobile/app/(member)/(tabs)/events.tsx` | Events | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | EN 375 |
| `/gallery` | `apps/member-mobile/app/(member)/(tabs)/gallery.tsx` | Gallery | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/` | `apps/member-mobile/app/(member)/(tabs)/index.tsx` | Home | Member | Rebuilt: plain greeting, compact membership card, next step with one button, quick actions as list rows, shared section headers; staff entry kept | EN 375; TA 375 and 320 |
| `/card/code` | `apps/member-mobile/app/(member)/card/code.tsx` | Membership card | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/card/full` | `apps/member-mobile/app/(member)/card/full.tsx` | Membership card | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/card/photo` | `apps/member-mobile/app/(member)/card/photo.tsx` | Membership card | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/card/progress` | `apps/member-mobile/app/(member)/card/progress.tsx` | Membership card | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/card/share` | `apps/member-mobile/app/(member)/card/share.tsx` | Membership card | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/card/sign` | `apps/member-mobile/app/(member)/card/sign.tsx` | Membership card | Member | Signature pad in neutral greys | Not opened; type check and builds |
| `/events/[id]` | `apps/member-mobile/app/(member)/events/[id].tsx` | Events | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/events/[id]/pass` | `apps/member-mobile/app/(member)/events/[id]/pass.tsx` | Events | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/fund` | `apps/member-mobile/app/(member)/fund/index.tsx` | Party fund | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/fund/receipt/[id]` | `apps/member-mobile/app/(member)/fund/receipt/[id].tsx` | Party fund | Member | Receipt number in charcoal instead of green | Not opened; type check and builds |
| `/gallery/[id]` | `apps/member-mobile/app/(member)/gallery/[id].tsx` | Gallery | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/gallery/photo` | `apps/member-mobile/app/(member)/gallery/photo.tsx` | Gallery | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/household/add` | `apps/member-mobile/app/(member)/household/add.tsx` | Household | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/household` | `apps/member-mobile/app/(member)/household/index.tsx` | Household | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/household/invitations` | `apps/member-mobile/app/(member)/household/invitations.tsx` | Household | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/household/invite` | `apps/member-mobile/app/(member)/household/invite.tsx` | Household | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/household/privacy` | `apps/member-mobile/app/(member)/household/privacy.tsx` | Household | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/hub` | `apps/member-mobile/app/(member)/hub.tsx` | Community hub | Member | Rebuilt: compact membership card, services as list rows, shared section headers | EN 375 |
| `/ideas` | `apps/member-mobile/app/(member)/ideas/index.tsx` | Ideas and proposals | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/ideas/new` | `apps/member-mobile/app/(member)/ideas/new.tsx` | Ideas and proposals | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/ideas/proposals/[id]` | `apps/member-mobile/app/(member)/ideas/proposals/[id].tsx` | Ideas and proposals | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/ideas/proposals/new` | `apps/member-mobile/app/(member)/ideas/proposals/new.tsx` | Ideas and proposals | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/issues/[id]` | `apps/member-mobile/app/(member)/issues/[id].tsx` | Local area and issues | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/issues` | `apps/member-mobile/app/(member)/issues/index.tsx` | Local area and issues | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/issues/mine` | `apps/member-mobile/app/(member)/issues/mine.tsx` | Local area and issues | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/issues/report` | `apps/member-mobile/app/(member)/issues/report.tsx` | Local area and issues | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | TA 375 and 320 |
| `/issues/review` | `apps/member-mobile/app/(member)/issues/review.tsx` | Local area and issues | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/learning/[course]` | `apps/member-mobile/app/(member)/learning/[course].tsx` | Learning | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/learning/[course]/[lesson]` | `apps/member-mobile/app/(member)/learning/[course]/[lesson].tsx` | Learning | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/learning` | `apps/member-mobile/app/(member)/learning/index.tsx` | Learning | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/notifications` | `apps/member-mobile/app/(member)/notifications.tsx` | Notifications | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/official` | `apps/member-mobile/app/(member)/official/index.tsx` | Statements (fact checks) | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/official/report` | `apps/member-mobile/app/(member)/official/report.tsx` | Statements (fact checks) | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/profile/accessibility` | `apps/member-mobile/app/(member)/profile/accessibility.tsx` | Profile and settings | Member | Shared monochrome switch | Not opened; type check and builds |
| `/profile/activity` | `apps/member-mobile/app/(member)/profile/activity.tsx` | Profile and settings | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/profile/area` | `apps/member-mobile/app/(member)/profile/area.tsx` | Profile and settings | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/profile/edit` | `apps/member-mobile/app/(member)/profile/edit.tsx` | Profile and settings | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/profile` | `apps/member-mobile/app/(member)/profile/index.tsx` | Profile and settings | Member | Rebuilt: white identity card (initial, name, member ID, states), list rows for every link, standard sign-out button | EN 375 |
| `/profile/privacy` | `apps/member-mobile/app/(member)/profile/privacy.tsx` | Profile and settings | Member | Fixed font sizes and yellow corner decorations removed, neutral icon tiles | Not opened; type check and builds |
| `/profile/recovery-number` | `apps/member-mobile/app/(member)/profile/recovery-number.tsx` | Profile and settings | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/profile/security` | `apps/member-mobile/app/(member)/profile/security.tsx` | Profile and settings | Member | Fixed font sizes and yellow corner decoration removed, neutral icon tiles | Not opened; type check and builds |
| `/profile/settings` | `apps/member-mobile/app/(member)/profile/settings.tsx` | Profile and settings | Member | Fixed font sizes removed (Tamil scale applies), charcoal language choice, neutral topic tiles, shared switch; Puvi's narrow-screen stacking kept | EN 375 |
| `/promises/[id]` | `apps/member-mobile/app/(member)/promises/[id].tsx` | Promise tracker | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/promises` | `apps/member-mobile/app/(member)/promises/index.tsx` | Promise tracker | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/promises/scorecard` | `apps/member-mobile/app/(member)/promises/scorecard.tsx` | Promise tracker | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/referrals` | `apps/member-mobile/app/(member)/referrals/index.tsx` | Invitations | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/referrals/invite` | `apps/member-mobile/app/(member)/referrals/invite.tsx` | Invitations | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/setup` | `apps/member-mobile/app/(member)/setup/index.tsx` | Account setup | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/setup/survey` | `apps/member-mobile/app/(member)/setup/survey.tsx` | Account setup | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/alerts` | `apps/member-mobile/app/(member)/staff/(tabs)/alerts.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/approvals` | `apps/member-mobile/app/(member)/staff/(tabs)/approvals.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/check-in` | `apps/member-mobile/app/(member)/staff/(tabs)/check-in.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff` | `apps/member-mobile/app/(member)/staff/(tabs)/index.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/profile` | `apps/member-mobile/app/(member)/staff/(tabs)/profile.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/assignments` | `apps/member-mobile/app/(member)/staff/assignments.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/card-check` | `apps/member-mobile/app/(member)/staff/card-check.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/checkin/[id]` | `apps/member-mobile/app/(member)/staff/checkin/[id].tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/field-visits` | `apps/member-mobile/app/(member)/staff/field-visits/index.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/field-visits/new` | `apps/member-mobile/app/(member)/staff/field-visits/new.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/field-visits/sync` | `apps/member-mobile/app/(member)/staff/field-visits/sync.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/lookup` | `apps/member-mobile/app/(member)/staff/lookup.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/roster/[id]` | `apps/member-mobile/app/(member)/staff/roster/[id].tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/sessions` | `apps/member-mobile/app/(member)/staff/sessions.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/volunteers/[id]` | `apps/member-mobile/app/(member)/staff/volunteers/[id].tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/staff/volunteers` | `apps/member-mobile/app/(member)/staff/volunteers/index.tsx` | Staff section | Staff (role and authenticator) | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/support/[id]` | `apps/member-mobile/app/(member)/support/[id].tsx` | Community support | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/support` | `apps/member-mobile/app/(member)/support/index.tsx` | Community support | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/support/request` | `apps/member-mobile/app/(member)/support/request.tsx` | Community support | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/surveys/[id]` | `apps/member-mobile/app/(member)/surveys/[id].tsx` | Surveys | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/surveys/[id]/done` | `apps/member-mobile/app/(member)/surveys/[id]/done.tsx` | Surveys | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/surveys` | `apps/member-mobile/app/(member)/surveys/index.tsx` | Surveys | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/town-halls/[id]` | `apps/member-mobile/app/(member)/town-halls/[id].tsx` | Town halls | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/town-halls` | `apps/member-mobile/app/(member)/town-halls/index.tsx` | Town halls | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/verify` | `apps/member-mobile/app/(member)/verify.tsx` | Identity verification | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/verify/appeal` | `apps/member-mobile/app/(member)/verify/appeal.tsx` | Identity verification | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/volunteer/[id]` | `apps/member-mobile/app/(member)/volunteer/[id].tsx` | Volunteering | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/volunteer/assignments` | `apps/member-mobile/app/(member)/volunteer/assignments.tsx` | Volunteering | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/volunteer` | `apps/member-mobile/app/(member)/volunteer/index.tsx` | Volunteering | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/volunteer/skills` | `apps/member-mobile/app/(member)/volunteer/skills.tsx` | Volunteering | Member | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/help/support` | `apps/member-mobile/app/help/support.tsx` | Public (no account) | Anyone | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |
| `/join/[token]` | `apps/member-mobile/app/join/[token].tsx` | Public (no account) | Anyone | Shared design system: monochrome tokens, Tamil type scale, shared components | Not opened; type check and builds |

The 7 layouts (`_layout.tsx`) carry the tab bar, the top bar and the headers described above.

## What did not change

- **Features and rules:** no feature, route, API, database table, permission or role.
- **The membership card:**
  - keeps all its information, the live 60-second QR, and the offline, pending and suspended states;
  - its photo and signature still belong to the member alone.
- **The official logo:** used as it is.

## Not checked

- **The Staff section:** it sits behind the authenticator code, so it was not opened in the browser here.
- **Large accessibility text on a real phone:** the browser cannot emulate the phone's font scale. Puvi's `useResponsiveLayout` still stacks cards when the scale is large.
