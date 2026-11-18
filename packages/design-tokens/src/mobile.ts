// Design tokens for the Expo app, members and the Staff section (import '@my-people/design-tokens/mobile').
//
// On 18 November 2026 the owner chose the sage design from the 174-screen design package for the
// app: a soft sage-and-white page, frosted white cards, deep sage for primary actions and the chosen
// state, and one outlined icon set at fixed sizes. It replaces Puvi's red, yellow and gold theme of
// 12 November in the app only; the PWA and the dashboard keep the root entry's colours, and so do
// the party's official marks (the TMK logo, flag and the membership card, which import the root
// entry directly). Spacing, control heights and type sizes still come from the root entry.
//
// Fonts are locked (CLAUDE.md): on 11 November 2026 the owner asked for Outfit for English and UI
// text in the Expo app, so it differs from the root entry's Inter. Tamil stays Noto Sans Tamil, which
// Outfit has no glyphs for, and IDs stay JetBrains Mono. Colours used for text pass WCAG AA on the
// surfaces they sit on (test/mobile.test.ts).
import * as brand from '@my-people/design-tokens';

const sage = {
  deep: '#365548',
  mid: '#426a54',
  light: '#7c9a88',
  ink: '#1d2925',
  pale: '#e5efe6',
  chosen: '#dce9df',
} as const;

export const colors = {
  ...brand.colors,
  // Deep sage carries primary actions, links, switches and the chosen tab; white reads at 8:1 on it.
  primary: sage.deep,
  primaryDark: '#273e32',
  primaryMid: sage.mid,
  primaryLight: sage.light,
  primaryContainer: sage.pale,
  onPrimary: '#ffffff',
  // The chosen state of chips, toggles and answer scales: a pale sage fill with a sage edge.
  brandYellow: sage.chosen,
  brandGold: sage.light,
  onBrandAccent: sage.ink,
  page: '#f6f8f5',
  card: '#ffffff',
  surfaceVariant: '#eef3ee',
  text: sage.ink,
  textSecondary: '#46524b',
  textMuted: '#5c6861',
  border: '#dfe7de',
  inputBorder: '#b7c4b9',
  divider: '#ebf0ea',
  controlBorder: '#6b7a70',
  focusRing: sage.deep,
  link: sage.deep,
  switchOn: sage.deep,
  warningBorder: '#f6e4bb',
  warningPill: '#ffe0a0',
  errorBorder: '#f3c9cf',
  /** Frosted card over the soft photographic background of Home, Events and Gallery. */
  glass: 'rgba(255, 255, 255, 0.8)',
  glassBorder: 'rgba(255, 255, 255, 0.92)',
  /** Shadow colour for the few raised surfaces (tab bar, frosted cards); kept very light. */
  shadow: '#203c30',
} as const;

/**
 * Pale tile behind an icon, with the icon's colour (quick actions, list rows, notices). The design
 * uses one calm sage tile for every function, so the old colour names all draw it; only rose
 * (sign-out, danger) and amber (warnings) keep a meaning of their own.
 */
const sageTile = { background: '#e8efe9', icon: sage.deep } as const;
export const tints = {
  blue: sageTile,
  green: sageTile,
  sand: sageTile,
  teal: sageTile,
  purple: sageTile,
  rose: { background: '#fbe9e9', icon: '#b42318' },
  amber: { background: '#fdf1dc', icon: '#9a5b00' },
  brand: sageTile,
} as const;

export type Tint = keyof typeof tints;

/**
 * Icon sizes in pixels, one per place, so the same function looks the same everywhere. Ionicons'
 * outline set is the app's one icon library (about a 1.8 px stroke at 24 px).
 */
export const iconSize = {
  /** Bottom tab bar. */
  tab: 24,
  /** Profile, notifications and back in the top bar. */
  header: 22,
  /** Quick-action tiles and notices (on a 48 px tile). */
  action: 24,
  /** Leading icon of a list row (on a 40 px tile) and of a card heading. */
  row: 20,
  /** A trailing chevron or a small inline icon beside text. */
  chevron: 18,
  /** Status marks inside tags and beside short labels. */
  status: 16,
  /** The one large icon of an empty, success or error state. */
  state: 40,
} as const;

/** Square tiles that hold an icon: 48 for quick actions and notices, 40 for list rows, 40 for header buttons. */
export const iconTile = { action: 48, row: 40, header: 40 } as const;

/** Spacing on the PWA's 4-point grid; the screen gutter is 16. */
export const spacing = { ...brand.spacing, 5: 20 } as const;

/** Corner radii: tags 4, icon tiles 12, inputs and buttons 14, cards 18, sheets 22 (the sage design's soft corners). */
export const radius = { ...brand.radius, control: 14, card: 18, input: 14, tile: 12, sheet: 22 } as const;

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

/**
 * The roomier scale for member-facing native screens (Puvi, 13 November 2026), on the same steps;
 * fonts stay locked. Apps opt in with AppTypographyProvider; the default scale stays the PWA's.
 */
export const comfortableTypeScale = {
  display: brand.comfortableTypeScale.page,
  page: brand.comfortableTypeScale.page,
  title: brand.comfortableTypeScale.section,
  section: brand.comfortableTypeScale.section,
  card: brand.comfortableTypeScale.card,
  body: brand.comfortableTypeScale.body,
  label: brand.comfortableTypeScale.label,
  secondary: brand.comfortableTypeScale.secondary,
  caption: brand.comfortableTypeScale.caption,
  nav: brand.comfortableTypeScale.nav,
} as const satisfies Record<keyof typeof typeScale, { size: number; lineHeight: number; weight: FontWeight }>;

/** Tamil script needs more line height than Latin text. */
export const lineHeightRatio = brand.lineHeightRatio;

export const motion = brand.motion;
