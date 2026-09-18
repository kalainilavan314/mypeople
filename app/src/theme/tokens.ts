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

  success: 'var(--success)',
  successBg: 'var(--success-bg)',
  warning: 'var(--warning)',
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

export const font = {
  ui: "'Inter', ui-sans-serif, system-ui, sans-serif",
  head: "'Inter', ui-sans-serif, system-ui, sans-serif",
  ta: "'Noto Sans Tamil', 'Inter', sans-serif",
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

// Accent scale (logo navy + variants). Name kept as `green` for back-compat.
export const green = {
  50: '#F5F9FF',
  100: '#E4EDFB',
  200: '#C3D8F4',
  300: '#8FB4E6',
  bright: '#203B59',
  400: '#0F57BC',
  base: '#14263D',
  500: '#14263D',
  deep: '#032B68',
  600: '#032B68',
  700: '#021D47',
  ink: '#FFFFFF',
} as const;

// Brand button gradient (logo navy) — used on CTAs / active tab.
export const greenGradient = 'linear-gradient(135deg, #14263D 0%, #203B59 100%)';

export const authC = {
  // Surfaces — white and near-white with a faint cool cast.
  bg: '#F7FAFD',
  bgDeep: '#EEF3F9',
  surface: '#FFFFFF',
  surface2: '#EFF4FA',
  field: '#F2F6FC', // input fill — Material "filled" style
  fieldBorder: '#E4EAF2',
  fieldFocus: '#14263D',
  line: '#E4EAF2',
  glass: 'rgba(255,255,255,.85)',
  glassBorder: 'rgba(255,255,255,.7)',

  // Accent (logo navy)
  green: '#14263D',
  greenBright: '#203B59',
  greenDeep: '#032B68',
  greenSoft: '#E4EDFB',
  greenGrad: greenGradient,
  greenGradPressed: 'linear-gradient(135deg, #032B68 0%, #14263D 100%)',
  greenGlow: '0 8px 24px -6px rgba(4,48,116,.38)',

  // Accent purple / blue
  purple: '#7A5CC4',
  lavender: '#017DFC',

  // Text
  text: '#0B1B3A',
  text2: '#4A5A78',
  text3: '#687481', // muted / placeholder
  onGreen: '#FFFFFF',

  // Semantic
  error: '#C10504',
  errorSoft: '#FDE4E4',
  success: '#1F8B34',
} as const;

export const ease = 'cubic-bezier(.22,.61,.36,1)';
export const dur = { fast: 160, mid: 260, slow: 480 } as const;

// Radii mirror tokens.css --r-* (brief scale): input 12, card 16, feature 20–24.
export const radius = {
  sm: 12, // inputs, small controls
  md: 14,
  lg: 16, // standard card
  xl: 20, // feature card
  xxl: 24, // large feature card
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
  gutter: 20, // mobile page horizontal padding
} as const;

// Control heights (mirror --control-h*).
export const control = { h: 56, hSm: 52, touchMin: 44 } as const;

// Typography scale (px). `lh` = line-height px, `ls` = letter-spacing.
// Tamil should not inherit negative tracking — pass the `.ta`/lang override in CSS.
export const type = {
  page: { size: 28, lh: 36, weight: 700, ls: '-0.02em' },
  section: { size: 22, lh: 28, weight: 700, ls: '-0.01em' },
  card: { size: 18, lh: 24, weight: 600, ls: 'normal' },
  body: { size: 16, lh: 24, weight: 400, ls: 'normal' },
  label: { size: 14, lh: 20, weight: 600, ls: 'normal' },
  secondary: { size: 14, lh: 20, weight: 400, ls: 'normal' },
  caption: { size: 12, lh: 16, weight: 500, ls: 'normal' },
  nav: { size: 12, lh: 16, weight: 600, ls: 'normal' },
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
