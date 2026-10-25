import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-tamil/700.css';
import './globals.css';

import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

import { colors, cssFontStack } from '@my-people/design-tokens';

export const metadata: Metadata = {
  title: 'My People · Administration',
  description: 'Staff dashboard for My People (என் மக்கள்)',
  // A staff tool: never listed by search engines.
  robots: { index: false, follow: false },
};

// The design tokens become CSS variables here, and globals.css maps them into
// Tailwind's theme, so packages/design-tokens stays the one source of colours
// and the locked fonts.
const toKebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const tokenVariables = {
  ...Object.fromEntries(Object.entries(colors).map(([name, value]) => [`--mp-${toKebab(name)}`, value])),
  '--mp-font-ui': cssFontStack.ui,
  '--mp-font-mono': cssFontStack.mono,
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" style={tokenVariables} className="h-full antialiased">
      <body className="min-h-full bg-page font-sans text-ink">{children}</body>
    </html>
  );
}
