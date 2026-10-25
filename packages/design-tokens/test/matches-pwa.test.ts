// The live PWA keeps its own token files until it is retired. These tests
// fail if this package and the PWA drift apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as pwa from '../../../app/src/core/theme/tokens.ts';
import { colors, control, cssFontStack, fontFamily, lineHeightRatio, motion, radius, spacing, typeScale } from '../src/index.ts';

const css = readFileSync(new URL('../../../app/src/core/theme/tokens.css', import.meta.url), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

function cssVariable(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(rootBlock);
  assert.ok(match, `--${name} is missing from tokens.css`);
  return match[1].trim();
}

// Which PWA variable each colour comes from.
const colorSource: Record<keyof typeof colors, string> = {
  primary: 'primary',
  primaryDark: 'primary-dark',
  primaryMid: 'primary-mid',
  primaryLight: 'primary-light',
  primaryContainer: 'primary-container',
  onPrimary: 'on-primary',
  page: 'page',
  card: 'card',
  surfaceVariant: 'surface-variant',
  text: 'ink',
  textSecondary: 'ink-2',
  textMuted: 'ink-3',
  border: 'hairline',
  inputBorder: 'hairline-2',
  divider: 'hairline-3',
  controlBorder: 'control-border',
  focusRing: 'focus-ring',
  success: 'success',
  successText: 'success-text',
  successBackground: 'success-bg',
  warning: 'warning',
  warningText: 'warning-text',
  warningBackground: 'warning-bg',
  error: 'error',
  errorBackground: 'error-bg',
};

test('colours match the PWA', () => {
  for (const [name, variable] of Object.entries(colorSource)) {
    assert.equal(colors[name as keyof typeof colors], cssVariable(variable).toLowerCase(), name);
  }
});

test('spacing, radii and control sizes match the PWA', () => {
  assert.deepEqual(spacing, pwa.space);
  assert.equal(radius.tag, pwa.radius.xs);
  assert.equal(radius.control, pwa.radius.sm);
  assert.equal(radius.card, pwa.radius.lg);
  assert.equal(radius.pill, pwa.radius.pill);
  assert.deepEqual(control, { height: pwa.control.h, heightSmall: pwa.control.hSm, touchMin: pwa.control.touchMin });
});

test('the type scale matches the PWA', () => {
  for (const [name, step] of Object.entries(typeScale)) {
    const source = pwa.type[name as keyof typeof pwa.type];
    assert.deepEqual(step, { size: source.size, lineHeight: source.lh, weight: source.weight }, name);
  }
  assert.equal(lineHeightRatio.latin, Number(cssVariable('line-latin')));
  assert.equal(lineHeightRatio.tamil, Number(cssVariable('line-tamil')));
});

test('fonts are the locked fonts', () => {
  assert.equal(cssFontStack.ui, cssVariable('font-ui'));
  assert.equal(cssFontStack.mono, cssVariable('font-mono'));
  assert.deepEqual(fontFamily, { ui: 'Inter', tamil: 'Noto Sans Tamil', mono: 'JetBrains Mono' });
});

test('motion matches the PWA', () => {
  assert.deepEqual(motion, { easing: pwa.ease, fastMs: pwa.dur.fast, midMs: pwa.dur.mid, slowMs: pwa.dur.slow });
});
