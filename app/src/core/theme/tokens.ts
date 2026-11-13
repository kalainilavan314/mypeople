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

  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  accentContainer: 'var(--accent-container)',
  onAccentContainer: 'var(--on-accent-container)',
} as const;

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
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  head: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  ta: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  taSerif: "'Noto Serif Tamil', 'Noto Sans Tamil', serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const green = {
  50: '#FFF5F5',
  100: '#FBE9EA',
  200: '#F2C4C7',
  300: '#E58E93',
  bright: '#C51A23',
  400: '#D9585F',
  base: '#B5121B',
  500: '#B5121B',
  deep: '#8D0A12',
  600: '#8D0A12',
  700: '#65070D',
  ink: '#FFFFFF',
} as const;

export const greenGradient = '#B5121B';

export const authC = {
  bg: '#FFFBF5',
  bgDeep: '#F7F0E6',
  surface: '#FFFFFF',
  surface2: '#F7F0E6',
  field: '#FFFBF5', // input fill
  fieldBorder: '#CDBFAE', // spec input border
  fieldFocus: '#B5121B',
  line: '#EADFCF',
  glass: 'rgba(255,255,255,.85)',
  glassBorder: 'rgba(255,255,255,.7)',

  green: '#B5121B',
  greenBright: '#C51A23',
  greenDeep: '#8D0A12',
  greenSoft: '#FBE9EA',
  greenGrad: greenGradient,
  greenGradPressed: '#8D0A12',
  greenGlow: '0 8px 24px -6px rgba(141,10,18,.38)',

  purple: '#B5121B',
  lavender: '#B5121B',

  text: '#211E1B',
  text2: '#514A43',
  text3: '#665E56', // muted / placeholder
  onGreen: '#FFFFFF',

  error: '#B91C1C',
  errorSoft: '#FEF2F2',
  success: '#059669',
} as const;

export const ease = 'cubic-bezier(.22,.61,.36,1)';
export const dur = { fast: 160, mid: 260, slow: 480 } as const;

export const radius = {
  xs: 4, // status tags
  sm: 8, // inputs, buttons
  md: 8,
  lg: 12, // standard card
  xl: 12,
  xxl: 12,
  pill: 999,
} as const;

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

export const control = { h: 48, hSm: 44, touchMin: 44 } as const;

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

export const tier: Record<
  Tier,
  { key: Tier; nameTa: string; nameEn: string; color: string; soft: string }
> = {
  sprout: { key: 'sprout', nameTa: 'முளை', nameEn: 'Sprout', color: c.sprout, soft: c.sproutSoft },
  root: { key: 'root', nameTa: 'வேர்', nameEn: 'Root', color: c.root, soft: c.rootSoft },
  palmyra: {
    key: 'palmyra',
    nameTa: 'பனை',
    nameEn: 'Palmyra',
    color: c.palmyra,
    soft: 'rgba(142,152,183,.15)',
  },
};
