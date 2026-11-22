import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-tamil/700.css';
import './globals.css';

import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

import { colors, cssFontStack, dashboardAccents, dashboardColors } from '@my-people/design-tokens';
import { LanguageProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';

export const metadata: Metadata = {
  title: 'TMK · Administration',
  description: 'Staff dashboard for TMK (தாயக மக்கள் கழகம்)',
  // A staff tool: never listed by search engines.
  robots: { index: false, follow: false },
};

export const instant = false;

// The design tokens become CSS variables here, and globals.css maps them into
// Tailwind's theme, so packages/design-tokens stays the one source of colours
// and the locked fonts.
const toKebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
// The dashboard's own neutrals (dashboardColors) replace the shared ones; brand and status colours stay.
const tokenVariables = {
  ...Object.fromEntries(
    Object.entries({ ...colors, ...dashboardColors }).map(([name, value]) => [`--mp-${toKebab(name)}`, value]),
  ),
  ...Object.fromEntries(Object.entries(dashboardAccents).map(([name, value]) => [`--mp-accent-${name}`, value])),
  '--mp-font-ui': cssFontStack.ui,
  '--mp-font-mono': cssFontStack.mono,
} as CSSProperties;

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale: Locale = 'en';

  return (
    <html
      lang={locale}
      dir="ltr"
      style={tokenVariables}
      className="h-full antialiased">
      <body className="min-h-full bg-page font-sans text-ink">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
