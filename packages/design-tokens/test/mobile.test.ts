// The mobile apps' colours must stay readable: WCAG 2.2 AA (4.5:1) for text on the surfaces it sits on.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { colors, comfortableTypeScale, fontFamily, tamilComfortableTypeScale, tints } from '../src/mobile.ts';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('text colours pass AA on the page, cards and their own backgrounds', () => {
  const pairs: [string, string, string][] = [
    ['text on page', colors.text, colors.page],
    ['secondary on page', colors.textSecondary, colors.page],
    ['muted on page', colors.textMuted, colors.page],
    ['muted on card', colors.textMuted, colors.card],
    ['muted on surface variant', colors.textMuted, colors.surfaceVariant],
    ['link on card', colors.link, colors.card],
    ['link on warning background', colors.link, colors.warningBackground],
    ['on primary', colors.onPrimary, colors.primary],
    ['on selected', colors.onSelected, colors.selected],
    ['secondary on surface variant', colors.textSecondary, colors.surfaceVariant],
    ['warning text', colors.warningText, colors.warningBackground],
    ['warning text on pill', colors.warningText, colors.warningPill],
    ['success text', colors.successText, colors.successBackground],
    ['error text', colors.error, colors.errorBackground],
    ['error on card', colors.error, colors.card],
  ];
  for (const [name, foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${name}: ${contrast(foreground, background).toFixed(2)}`);
  }
});

test('icons on their tinted tiles reach the 3:1 non-text contrast', () => {
  for (const [name, tint] of Object.entries(tints)) {
    assert.ok(contrast(tint.icon, tint.background) >= 3, `${name}: ${contrast(tint.icon, tint.background).toFixed(2)}`);
  }
});

test('inactive icons reach the 3:1 non-text contrast on white', () => {
  assert.ok(contrast(colors.iconInactive, colors.card) >= 3);
});

// The owner's monochrome design (18 November 2026): no red, yellow or gold as interface accents. A
// colour is "neutral" when its red, green and blue channels are within a few steps of each other.
test('interface colours are neutral greys; only state colours carry a hue', () => {
  const states = new Set(Object.keys(colors).filter((name) => /^(success|warning|error)/.test(name)));
  for (const [name, hex] of Object.entries(colors)) {
    if (states.has(name)) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 4, `${name} ${hex} is not a neutral grey`);
  }
});

test('Tamil is a step more compact than English, never below 12, with room for vowel signs', () => {
  for (const [step, tamil] of Object.entries(tamilComfortableTypeScale)) {
    const english = comfortableTypeScale[step as keyof typeof comfortableTypeScale];
    assert.ok(tamil.size <= english.size, `${step}: Tamil ${tamil.size} > English ${english.size}`);
    assert.ok(tamil.size >= 12, `${step}: Tamil ${tamil.size} is below 12`);
    assert.ok(tamil.lineHeight / tamil.size >= 1.5, `${step}: Tamil line height ${tamil.lineHeight} is too tight`);
  }
});

test('Tamil keeps Noto Sans Tamil and IDs keep JetBrains Mono', () => {
  assert.equal(fontFamily.tamil, 'Noto Sans Tamil');
  assert.equal(fontFamily.mono, 'JetBrains Mono');
});
