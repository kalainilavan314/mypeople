// Design tokens for the Expo member and staff apps (import '@my-people/design-tokens/mobile').
//
// Taken from the reference recording the owner supplied on 11 November 2026: a softer page, white
// cards with fine borders, a deeper navy, larger rounded controls and tinted icon tiles. The root
// entry ('@my-people/design-tokens') keeps the PWA's values for the dashboard and the PWA, which
// test/matches-pwa.test.ts guards; these values are allowed to differ from it.
//
// Fonts: on 11 November 2026 the owner asked for Outfit for English and UI text in these apps
// (CLAUDE.md records the change). Tamil stays Noto Sans Tamil, which Outfit has no glyphs for, and IDs
// stay JetBrains Mono. Colours used for text pass WCAG AA on the surfaces they sit on
// (test/mobile.test.ts); where the recording's grey was fainter than that, it is darkened slightly.

export const colors = {
  primary: '#13244b',
  primaryDark: '#0b1733',
  primaryMid: '#22386b',
  primaryLight: '#4a5a80',
  primaryContainer: '#e7ecf4',
  onPrimary: '#ffffff',

  page: '#f3f4f9',
  card: '#ffffff',
  surfaceVariant: '#eef1f7',

  text: '#161b2e',
  textSecondary: '#3d4356',
  textMuted: '#656a7a',
  link: '#2f62c9',

  border: '#e6e9f0',
  inputBorder: '#d5dae4',
  divider: '#eef0f5',
  controlBorder: '#6b7280',
  focusRing: '#13244b',
  switchOn: '#386ccc',

  // Status is never shown by colour alone: always pair it with an icon and a label.
  success: '#059669',
  successText: '#047857',
  successBackground: '#e6f4ee',
  warning: '#d97706',
  warningText: '#7c5200',
  warningBackground: '#fdf4e1',
  warningBorder: '#f6e4bb',
  warningPill: '#ffe0a0',
  error: '#b91c1c',
  errorBackground: '#fdecec',
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
  navy: { background: '#e7ecf4', icon: '#13244b' },
} as const;

export type Tint = keyof typeof tints;

/** Spacing on an 8-point grid, in pixels; the screen gutter is 20. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  gutter: 20,
} as const;

/** Corner radii: status pills fully round, inputs 12, buttons 14, cards 16, sheets 22. */
export const radius = {
  tag: 999,
  input: 12,
  control: 14,
  card: 16,
  tile: 14,
  sheet: 22,
  pill: 999,
} as const;

/** Heights in pixels. Every touch target is at least 44 × 44; main buttons are 56. */
export const control = {
  height: 56,
  heightSmall: 48,
  input: 52,
  touchMin: 44,
  tabBar: 64,
} as const;

/** Font family names; the apps load them with expo-font. */
export const fontFamily = {
  ui: 'Outfit',
  tamil: 'Noto Sans Tamil',
  mono: 'JetBrains Mono',
} as const;

export type FontWeight = 300 | 400 | 500 | 600 | 700;

/** Type scale: size and line height in pixels. Never use negative letter spacing. */
export const typeScale = {
  display: { size: 30, lineHeight: 38, weight: 400 },
  page: { size: 28, lineHeight: 36, weight: 400 },
  title: { size: 19, lineHeight: 26, weight: 400 },
  section: { size: 20, lineHeight: 28, weight: 400 },
  card: { size: 17, lineHeight: 24, weight: 500 },
  body: { size: 16, lineHeight: 24, weight: 400 },
  label: { size: 16, lineHeight: 22, weight: 500 },
  secondary: { size: 15, lineHeight: 22, weight: 400 },
  caption: { size: 13, lineHeight: 18, weight: 400 },
  nav: { size: 12, lineHeight: 16, weight: 400 },
} as const satisfies Record<string, { size: number; lineHeight: number; weight: FontWeight }>;

/** Tamil script needs more line height than Latin text. */
export const lineHeightRatio = {
  latin: 1.45,
  tamil: 1.65,
} as const;

export const motion = {
  easing: 'cubic-bezier(.22,.61,.36,1)',
  fastMs: 160,
  midMs: 260,
  slowMs: 480,
} as const;
