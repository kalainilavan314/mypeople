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
  ui: "'Outfit', ui-sans-serif, system-ui, sans-serif",
  head: "'Outfit', ui-sans-serif, system-ui, sans-serif",
  ta: "'Noto Sans Tamil', 'Outfit', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

// ----------------------------------------------------------------------------
// Auth theme — NorthUnity light: warm-paper surface, filled surfaceVariant
// fields, palmyrah-gold CTAs. Kept as a SEPARATE token set from `c` because the
// auth screens are always light (they render before the theme preference is
// known), but the palette matches the rest of the app.
// Legacy key names (`green*`) are retained so GreenButton / parts.tsx keep
// working — they simply hold gold values now.
// ----------------------------------------------------------------------------

// Accent scale (palmyrah gold + variants). Name kept as `green` for back-compat.
export const green = {
  50: '#FFFBF2',
  100: '#FFF3D6',
  200: '#FFE4A8',
  300: '#FFD080',
  bright: '#FFB347',
  400: '#F0B95A',
  base: '#E8A838',
  500: '#E8A838',
  deep: '#C98F26',
  600: '#C98F26',
  700: '#8A5F13',
  ink: '#FFFFFF',
} as const;

// Brand button gradient (palmyrah gold) — used on CTAs / active tab.
export const greenGradient = 'linear-gradient(135deg, #E8A838 0%, #FFB347 100%)';

export const authC = {
  // Surfaces
  bg: '#FAFAF7', // page background (NorthUnity warm paper)
  bgDeep: '#F5F0E8', // deepest / outer
  surface: '#FFFDF8', // raised card
  surface2: '#F5F0E8',
  field: '#F5F0E8', // input fill — Material "filled" style
  fieldBorder: '#EDE8DF',
  fieldFocus: '#E8A838',
  line: '#EDE8DF',
  glass: 'rgba(255,255,255,.85)',
  glassBorder: 'rgba(255,255,255,.7)',

  // Accent (palmyrah gold)
  green: '#E8A838',
  greenBright: '#FFB347',
  greenDeep: '#C98F26',
  greenSoft: '#FFF3D6',
  greenGrad: greenGradient,
  greenGradPressed: 'linear-gradient(135deg, #C98F26 0%, #E8A838 100%)',
  greenGlow: '0 8px 24px -6px rgba(232,168,56,.46)',

  // Accent purple / blue
  purple: '#9B6BB5',
  lavender: '#4A90D9',

  // Text
  text: '#1C1917',
  text2: '#5C5751',
  text3: '#B8B2A8', // muted / placeholder
  onGreen: '#FFFFFF',

  // Semantic
  error: '#B91C1C',
  errorSoft: '#FEE2E2',
  success: '#2D7A4F',
} as const;

export const ease = 'cubic-bezier(.22,.61,.36,1)';
export const dur = { fast: 160, mid: 260, slow: 480 } as const;

export const radius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
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
