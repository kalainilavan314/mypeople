// Design tokens for the Expo app, members and the Staff section (import '@my-people/design-tokens/mobile').
//
// The owner asked on 18 November 2026 for a calm monochrome app: a near-white page, white cards,
// charcoal text and actions, neutral greys for borders and quiet surfaces, and no red, yellow or
// gold as interface accents. The app therefore has its own palette here instead of the root entry's
// brand red and yellow, which the member PWA and the dashboard keep. Colour is never the only sign
// of a state: status colours (green, amber, red) stay, always with an icon and a label.
//
// Fonts are locked (CLAUDE.md): Outfit for English and UI text in the Expo app (the owner's choice on
// 11 November 2026), Noto Sans Tamil for Tamil, which Outfit has no glyphs for, and JetBrains Mono
// for IDs. Colours used for text pass WCAG AA on the surfaces they sit on (test/mobile.test.ts).
import * as brand from '@my-people/design-tokens';

export const colors = {
  // Primary actions: charcoal with white text (16:1).
  primary: '#202020',
  /** Pressed primary actions and the strongest emphasis. */
  primaryDark: '#000000',
  primaryLight: '#5c5c5c',
  /** A quiet grey surface for the one highlighted card on a screen (the next step on Home). */
  primaryContainer: '#f4f4f5',
  onPrimary: '#ffffff',

  /** The chosen chip, language or option: a charcoal fill with white text. */
  selected: '#171717',
  onSelected: '#ffffff',

  page: '#fafafa',
  card: '#ffffff',
  surfaceVariant: '#f4f4f5',

  text: '#171717',
  textSecondary: '#5f5f5f',
  textMuted: '#6e6e6e',
  /** Unselected tab icons and other inactive icons (3:1 on white). */
  iconInactive: '#777777',

  border: '#e7e7e7',
  inputBorder: '#c7c7c7',
  divider: '#efefef',
  controlBorder: '#767676',
  focusRing: '#171717',
  link: '#171717',

  // States, never shown by colour alone: always with an icon and a label.
  success: '#15803d',
  successText: '#166534',
  successBackground: '#f0fdf4',
  warning: '#b45309',
  warningText: '#92400e',
  warningBackground: '#fffbeb',
  warningBorder: '#f3e3bf',
  warningPill: '#fdf0d5',
  error: '#b91c1c',
  errorBackground: '#fef2f2',
  errorBorder: '#f3c9cf',
} as const;

/**
 * The tile behind an icon in rows, tiles and notices. Every name is the same neutral tile now: the
 * monochrome design has no rainbow icon grids, and the names stay so screens need not change.
 */
const NEUTRAL_TILE = { background: '#f4f4f5', icon: '#171717' } as const;
export const tints = {
  blue: NEUTRAL_TILE,
  green: NEUTRAL_TILE,
  sand: NEUTRAL_TILE,
  teal: NEUTRAL_TILE,
  purple: NEUTRAL_TILE,
  rose: NEUTRAL_TILE,
  amber: NEUTRAL_TILE,
  brand: NEUTRAL_TILE,
} as const;

export type Tint = keyof typeof tints;

/** Spacing on a 4-point grid: 4, 8, 12, 16, 20, 24, 32; the screen gutter is 16. */
export const spacing = { ...brand.spacing, 5: 20 } as const;

/** Corner radii: tags 6, inputs and buttons 12, cards and tiles 14, sheets 20. */
export const radius = { tag: 6, control: 12, input: 12, card: 14, tile: 12, sheet: 20, pill: 999 } as const;

/**
 * Heights in pixels. Every touch target is at least 48 (Android's 48 dp, above iOS's 44 pt); main
 * buttons and inputs are 50.
 */
export const control = { height: 50, heightSmall: 44, touchMin: 48, input: 50, tabBar: 72 } as const;

/** Font family names; the app loads them with expo-font. */
export const fontFamily = {
  ui: 'Outfit',
  tamil: 'Noto Sans Tamil',
  mono: 'JetBrains Mono',
} as const;

export type FontWeight = 300 | 400 | 500 | 600 | 700;

type Step = { size: number; lineHeight: number; weight: FontWeight };

/**
 * The compact type scale (the PWA's sizes, from the root entry), plus "display" and "title" at the
 * page and section sizes. Size and line height in pixels; never negative letter spacing.
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
} as const satisfies Record<string, Step>;

/** The scale the app's screens use (AppTypographyProvider "comfortable"), for English text. */
export const comfortableTypeScale = {
  display: { size: 24, lineHeight: 32, weight: 700 },
  page: { size: 24, lineHeight: 32, weight: 700 },
  title: { size: 18, lineHeight: 26, weight: 700 },
  section: { size: 18, lineHeight: 26, weight: 700 },
  card: { size: 16, lineHeight: 22, weight: 600 },
  body: { size: 16, lineHeight: 24, weight: 400 },
  label: { size: 14, lineHeight: 20, weight: 600 },
  secondary: { size: 14, lineHeight: 20, weight: 400 },
  caption: { size: 12, lineHeight: 17, weight: 600 },
  nav: { size: 12, lineHeight: 16, weight: 600 },
} as const satisfies Record<keyof typeof typeScale, Step>;

/**
 * The same scale for Tamil. Noto Sans Tamil draws larger than Outfit at the same size, so Tamil is a
 * step more compact (never below 12), with about 1.6 line height so vowel signs above and below the
 * letters are never clipped. Sizes only: no transform, no squeezed letters, no negative spacing.
 */
export const tamilComfortableTypeScale = {
  display: { size: 22, lineHeight: 34, weight: 700 },
  page: { size: 22, lineHeight: 34, weight: 700 },
  title: { size: 17, lineHeight: 27, weight: 700 },
  section: { size: 17, lineHeight: 27, weight: 700 },
  card: { size: 15, lineHeight: 24, weight: 600 },
  body: { size: 15, lineHeight: 24, weight: 400 },
  label: { size: 14, lineHeight: 22, weight: 600 },
  secondary: { size: 14, lineHeight: 22, weight: 400 },
  caption: { size: 12, lineHeight: 19, weight: 600 },
  nav: { size: 12, lineHeight: 18, weight: 600 },
} as const satisfies Record<keyof typeof typeScale, Step>;

/** Tamil script needs more line height than Latin text. */
export const lineHeightRatio = brand.lineHeightRatio;

export const motion = brand.motion;
