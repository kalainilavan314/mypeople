import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const tokensPath = new URL('../../packages/design-tokens/src/index.ts', import.meta.url);

function relativeLuminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('shared text and status token pairs meet WCAG AA contrast', async () => {
  const source = await readFile(tokensPath, 'utf8');
  const colors = Object.fromEntries([...source.matchAll(/^\s+(\w+): '(#[a-f\d]{6})',?$/gim)].map(([, name, hex]) => [name, hex]));
  const pairs = [
    ['text', 'card'],
    ['textSecondary', 'card'],
    ['textMuted', 'page'],
    ['onPrimary', 'primary'],
    ['successText', 'successBackground'],
    ['warningText', 'warningBackground'],
    ['error', 'errorBackground'],
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(colors[foreground] && colors[background], `missing ${foreground}/${background} colour tokens`);
    assert.ok(
      contrast(colors[foreground], colors[background]) >= 4.5,
      `${foreground} on ${background} must have at least 4.5:1 contrast`,
    );
  }
});
