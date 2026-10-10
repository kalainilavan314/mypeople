// Design tokens as TS constants for inline styles.
// Mirrors styles/tokens.css and PROJECT.md §Design foundations.

// Colour tokens reference CSS variables (defined in styles/tokens.css) so the
// whole app re-themes at runtime: light by default, dark when the <html> element
// carries data-theme="dark". Values for both themes live in tokens.css.
// `maroon*` = accent (lavender), `page/card` = surfaces, `ink*` = text.
export const c = {
  maroon: 'var(--maroon)',
  maroonPressed: 'var(--maroon-pressed)',
  maroonHover: 'var(--maroon-hover)',
  maroonTint: 'var(--maroon-tint)',
  maroonTintSoft: 'var(--maroon-tint-soft)',
  maroonTintBorder: 'var(--maroon-tint-border)',

  page: 'var(--page)',
  pageOuter: 'var(--page-outer)',
  card: 'var(--card)',
  cardCream: 'var(--card-cream)',
  cardWarm: 'var(--card-warm)',

  hairline: 'var(--hairline)',
  hairline2: 'var(--hairline-2)',
  hairline3: 'var(--hairline-3)',

  ink: 'var(--ink)',
  ink0: 'var(--ink-0)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',

  purple: 'var(--purple)',
  lavender: 'var(--lavender)',

  sprout: 'var(--sprout)',
  sproutSoft: 'var(--sprout-soft)',
  root: 'var(--root)',
  rootSoft: 'var(--root-soft)',
  palmyra: 'var(--palmyra)',

  gold: 'var(--gold)',

  success: 'var(--success-text)',
  successAccent: 'var(--success)',
  successBg: 'var(--success-bg)',
  warning: 'var(--warning-text)',
  warningAccent: 'var(--warning)',
  warningBg: 'var(--warning-bg)',
  error: 'var(--error)',
  errorBg: 'var(--error-bg)',
  info: 'var(--info)',

  // --- NorthNadu semantic set (Material-3 style names) ---------------------
  primary: 'var(--primary)',
  primaryLight: 'var(--primary-light)',
  primaryMid: 'var(--primary-mid)',
  primaryContainer: 'var(--primary-container)',
  onPrimaryContainer: 'var(--on-primary-container)',
  onPrimary: 'var(--on-primary)',
  secondary: 'var(--secondary)',
  secondaryContainer: 'var(--secondary-container)',
  tertiary: 'var(--tertiary)',
  tertiaryContainer: 'var(--tertiary-container)',
  surfaceVariant: 'var(--surface-variant)',

  // Teal accent — the single optional secondary accent (semantic colours stay
  // reserved for success/warning/error).
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  accentContainer: 'var(--accent-container)',
  onAccentContainer: 'var(--on-accent-container)',
} as const;

/** Gradients from the NorthUnity reference (action cards, CTAs, impact strip). */
export const grad = {
  primary: 'var(--grad-primary)',
  join: 'var(--grad-join)',
  volunteer: 'var(--grad-volunteer)',
  survey: 'var(--grad-survey)',
  community: 'var(--grad-community)',
  events: 'var(--grad-events)',
  agriculture: 'var(--grad-agriculture)',
  you: 'var(--grad-you)',
} as const;

// Latin-first everywhere so English never renders in Noto Sans Tamil; Tamil
// glyphs fall back to Noto per-glyph. `taSerif` stays Tamil-serif-first because
// it is only ever applied to pure-Tamil display slogans.
export const font = {
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  head: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  ta: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  taSerif: "'Noto Serif Tamil', 'Noto Sans Tamil', serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

// ----------------------------------------------------------------------------
// Auth theme — the sign-in screens are ALWAYS light: they render before the
// stored theme preference is known, so a dark-mode flash would be worse than
// simply committing to light. Kept as a separate token set from `c` for that
// reason, but sampled from the same logo — deep navy on white.
//
// The legacy key names (`green*`) are retained so GreenButton and parts.tsx keep
// working unchanged; they now hold navy values.
// ----------------------------------------------------------------------------

// Accent scale (Civic Navy #0F2942 + variants). Name kept as `green` for back-compat.
export const green = {
  50: '#F4F8FC',
  100: '#E8EDF3',
  200: '#C6D3E0',
  300: '#8CA0B6',
  bright: '#1B3A57',
  400: '#2563EB',
  base: '#0F2942',
  500: '#0F2942',
  deep: '#091D30',
  600: '#091D30',
  700: '#061320',
  ink: '#FFFFFF',
} as const;

// Brand button gradient (Civic Navy) — used on CTAs / active tab.
export const greenGradient = '#0F2942';

export const authC = {
  // Surfaces — white and near-white with a faint cool cast (spec §2.1).
  bg: '#F8FAFC',
  bgDeep: '#EEF3F9',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  field: '#F8FAFC', // input fill
  fieldBorder: '#CBD5E1', // spec input border
  fieldFocus: '#0F2942',
  line: '#E2E8F0',
  glass: 'rgba(255,255,255,.85)',
  glassBorder: 'rgba(255,255,255,.7)',

  // Accent (Civic Navy #0F2942)
  green: '#0F2942',
  greenBright: '#1B3A57',
  greenDeep: '#091D30',
  greenSoft: '#E8EDF3',
  greenGrad: greenGradient,
  greenGradPressed: '#091D30',
  greenGlow: '0 8px 24px -6px rgba(15,41,66,.38)',

  // Accent blue (spec Civic Blue)
  purple: '#2563EB',
  lavender: '#2563EB',

  // Text (spec §2.1)
  text: '#0F172A',
  text2: '#334155',
  text3: '#475569', // muted / placeholder
  onGreen: '#FFFFFF',

  // Semantic (spec §2.1)
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  success: '#059669',
} as const;

export const ease = 'cubic-bezier(.22,.61,.36,1)';
export const dur = { fast: 160, mid: 260, slow: 480 } as const;

// Radii mirror tokens.css --r-* (spec §8.2): inputs/buttons 6pt, cards ~12.
export const radius = {
  xs: 4, // status tags
  sm: 8, // inputs, buttons
  md: 8,
  lg: 12, // standard card
  xl: 12,
  xxl: 12,
  pill: 999,
} as const;

// 8px spacing scale (mirrors --space-*). Use for gaps/padding in inline styles.
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  gutter: 16,
} as const;

// Control heights (spec §8.2: input 44pt, primary button 40pt; we use 48 for
// comfortable touch, 44 inputs — both ≥ the 44px WCAG 2.5.5 target).
export const control = { h: 48, hSm: 44, touchMin: 44 } as const;

// Typography uses logical UI units, with no assumed pt-to-px multiplier. `lh` = line height,
// `ls` = letter-spacing. Tamil must not inherit negative tracking — the
// `:lang(ta)`/`.ta` override in global.css resets it and relaxes line-height.
export const type = {
  page: { size: 22, lh: 30, weight: 700, ls: 'normal' }, // Greeting / page title
  section: { size: 16, lh: 24, weight: 700, ls: 'normal' },
  card: { size: 13, lh: 20, weight: 600, ls: 'normal' },
  body: { size: 15, lh: 22, weight: 400, ls: 'normal' }, // Body / inputs
  label: { size: 13, lh: 18, weight: 600, ls: 'normal' }, // Input labels
  secondary: { size: 13, lh: 20, weight: 400, ls: 'normal' }, // Metadata
  caption: { size: 11, lh: 17, weight: 600, ls: 'normal' },
  nav: { size: 10, lh: 15, weight: 600, ls: 'normal' },
} as const;

export const shadow = {
  card: 'var(--shadow-card)',
  nav: 'var(--shadow-nav)',
  fab: 'var(--shadow-fab)',
  lg: 'var(--shadow-lg)',
  tile: 'var(--shadow-tile)',
} as const;

export type Tier = 'sprout' | 'root' | 'palmyra';

export const tier: Record<Tier, { key: Tier; nameTa: string; nameEn: string; color: string; soft: string }> = {
  sprout: { key: 'sprout', nameTa: 'முளை', nameEn: 'Sprout', color: c.sprout, soft: c.sproutSoft },
  root: { key: 'root', nameTa: 'வேர்', nameEn: 'Root', color: c.root, soft: c.rootSoft },
  palmyra: { key: 'palmyra', nameTa: 'பனை', nameEn: 'Palmyra', color: c.palmyra, soft: 'rgba(142,152,183,.15)' },
};
