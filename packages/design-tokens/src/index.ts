// Design tokens for the new apps: Expo member and staff apps, Next.js admin.
//
// Values are plain numbers and hex colours, so React Native and Tailwind can
// both use them. They come from the live PWA (app/src/core/theme/tokens.css
// and tokens.ts), and test/matches-pwa.test.ts fails if the two drift apart
// while both exist.
//
// Fonts are locked (see CLAUDE.md): Inter for English/UI text, Noto Sans Tamil
// for Tamil, JetBrains Mono for IDs. Do not change them here.

export const colors = {
  // Civic navy: 14.8:1 contrast on white.
  primary: '#0f2942',
  primaryDark: '#091d30',
  primaryMid: '#1b3a57',
  primaryLight: '#4a627c',
  primaryContainer: '#e8edf3',
  onPrimary: '#ffffff',

  page: '#f8fafc',
  card: '#ffffff',
  surfaceVariant: '#f1f5f9',

  text: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#475569',

  border: '#e2e8f0',
  inputBorder: '#cbd5e1',
  divider: '#f1f5f9',
  controlBorder: '#64748b',
  focusRing: '#0f2942',

  // Status is never shown by colour alone: always pair it with an icon and a label.
  success: '#059669',
  successText: '#047857',
  successBackground: '#ecfdf5',
  warning: '#d97706',
  warningText: '#92400e',
  warningBackground: '#fffbeb',
  // AA body-text contrast on the pale error surface.
  error: '#b91c1c',
  errorBackground: '#fef2f2',
} as const;

/** Spacing on an 8-point grid, in pixels. */
export const spacing = {
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

/** Corner radii in pixels: tags 4, inputs and buttons 8, cards 12. */
export const radius = {
  tag: 4,
  control: 8,
  card: 12,
  pill: 999,
} as const;

/** Heights in pixels. Every touch target is at least 44 × 44. */
export const control = {
  height: 48,
  heightSmall: 44,
  touchMin: 44,
} as const;

/** Font family names. Native apps load these fonts with expo-font. */
export const fontFamily = {
  ui: 'Inter',
  tamil: 'Noto Sans Tamil',
  mono: 'JetBrains Mono',
} as const;

/** The same font stacks the PWA uses, for web apps (Latin first, Tamil per glyph). */
export const cssFontStack = {
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Type scale: size and line height in pixels. Never use negative letter spacing. */
export const typeScale = {
  page: { size: 22, lineHeight: 30, weight: 700 },
  section: { size: 16, lineHeight: 24, weight: 700 },
  card: { size: 13, lineHeight: 20, weight: 600 },
  body: { size: 15, lineHeight: 22, weight: 400 },
  label: { size: 13, lineHeight: 18, weight: 600 },
  secondary: { size: 13, lineHeight: 20, weight: 400 },
  caption: { size: 11, lineHeight: 17, weight: 600 },
  nav: { size: 10, lineHeight: 15, weight: 600 },
} as const;

/** Tamil script needs more line height than Latin text. */
export const lineHeightRatio = {
  latin: 1.5,
  tamil: 1.65,
} as const;

export const motion = {
  easing: 'cubic-bezier(.22,.61,.36,1)',
  fastMs: 160,
  midMs: 260,
  slowMs: 480,
} as const;
