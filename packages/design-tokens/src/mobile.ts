// Design tokens for the Expo app, members and the Staff section (import '@my-people/design-tokens/mobile').
//
// Puvi's production UI (12 November 2026) centralised one brand theme: brand red for authority and
// primary actions, yellow for the chosen state, gold as a scarce accent, a warm cream page, flat white
// cards and the PWA's sizes. The owner chose it over the earlier reference-recording look, so the
// colours, spacing, corners, control heights and type sizes here come from the root entry
// ('@my-people/design-tokens'), which the PWA and the dashboard use too. This file only adds what
// the app needs on top: link and switch colours, softer warning and error edges, the tinted icon
// tiles, and the names of a few extra sizes the app's screens use.
//
// Fonts are locked (CLAUDE.md): on 11 November 2026 the owner asked for Outfit for English and UI
// text in the Expo app, so it differs from the root entry's Inter. Tamil stays Noto Sans Tamil, which
// Outfit has no glyphs for, and IDs stay JetBrains Mono. Colours used for text pass WCAG AA on the
// surfaces they sit on (test/mobile.test.ts).
import * as brand from '@my-people/design-tokens';

export const colors = {
  ...brand.colors,
  // Links and switches take the brand colour; it reads at 6:1 on the cream page and white cards.
  link: brand.colors.primary,
  switchOn: brand.colors.primary,
  warningBorder: '#f6e4bb',
  warningPill: '#ffe0a0',
  errorBorder: '#f3c9cf',
} as const;

/** Pale tile behind an icon, with the icon's colour (quick actions, list rows, notices). */
export const tints = {
  blue: { background: '#e5e9f6', icon: '#3b5bb5' },
  green: { background: '#e5efe9', icon: '#2f7d4f' },
  sand: { background: '#f1ebe2', icon: '#a0651a' },
  teal: { background: '#e3f3f1', icon: '#17806f' },
  purple: { background: '#eee9f9', icon: '#6f44c4' },
  rose: { background: '#fbe7e8', icon: '#c2414b' },
  amber: { background: '#fdf1dc', icon: '#b26a00' },
  brand: { background: brand.colors.primaryContainer, icon: brand.colors.primary },
} as const;

export type Tint = keyof typeof tints;

/** Spacing on the PWA's 4-point grid; the screen gutter is 16. */
export const spacing = { ...brand.spacing, 5: 20 } as const;

/** Corner radii: tags 4, inputs and buttons 8, cards and tiles 12, sheets 16. */
export const radius = { ...brand.radius, input: brand.radius.control, tile: brand.radius.card, sheet: 16 } as const;

/** Heights in pixels. Every touch target is at least 44 × 44; main buttons and inputs are 48. */
export const control = { ...brand.control, input: brand.control.height, tabBar: 56 } as const;

/** Font family names; the app loads them with expo-font. */
export const fontFamily = {
  ui: 'Outfit',
  tamil: 'Noto Sans Tamil',
  mono: 'JetBrains Mono',
} as const;

export type FontWeight = 300 | 400 | 500 | 600 | 700;

/**
 * Type scale: the PWA's sizes (root entry), plus "display" (a person's name on Home) and "title"
 * at the page and section sizes. Size and line height in pixels; never negative letter spacing.
 */
export const typeScale = {
  display: { size: 22, lineHeight: 30, weight: 700 },
  page: { size: 22, lineHeight: 30, weight: 700 },
  title: { size: 16, lineHeight: 24, weight: 700 },
  section: { size: 16, lineHeight: 24, weight: 700 },
  card: { size: 13, lineHeight: 20, weight: 600 },
  body: { size: 15, lineHeight: 22, weight: 400 },
  label: { size: 13, lineHeight: 18, weight: 600 },
  secondary: { size: 13, lineHeight: 20, weight: 400 },
  caption: { size: 11, lineHeight: 17, weight: 600 },
  nav: { size: 10, lineHeight: 15, weight: 600 },
} as const satisfies Record<string, { size: number; lineHeight: number; weight: FontWeight }>;

/** Tamil script needs more line height than Latin text. */
export const lineHeightRatio = brand.lineHeightRatio;

export const motion = brand.motion;
