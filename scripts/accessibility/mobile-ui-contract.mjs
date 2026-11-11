import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { control } from '../../packages/design-tokens/src/mobile.ts';

const root = new URL('../../', import.meta.url);
const source = async (name) => readFile(new URL(`packages/mobile-ui/src/components/${name}`, root), 'utf8');
const fontSource = async () => readFile(new URL('packages/mobile-ui/src/fonts.ts', root), 'utf8');

test('interactive shared controls expose a semantic role and a 48 px target', async () => {
  for (const name of ['Button.tsx', 'Checkbox.tsx', 'SelectField.tsx', 'TextField.tsx']) {
    const code = await source(name);
    assert.match(code, /accessibilityRole=/, `${name} needs a semantic accessibility role`);
    // Buttons use control.height (56) and fields control.input (52); both stay above the 48 px floor.
    assert.match(code, /control\.(height|input)/, `${name} needs a shared control height of at least 48 px`);
  }
  assert.ok(control.height >= 48 && control.input >= 48, 'shared control heights must stay at or above 48 px');
});

test('shared buttons and controls enforce minimum touch target dimensions', async () => {
  const button = await source('Button.tsx');
  const checkbox = await source('Checkbox.tsx');
  const select = await source('SelectField.tsx');

  assert.match(button, /minWidth:\s*control\.touchMin/, 'Button must enforce minimum touch target width');
  assert.match(button, /minHeight:\s*control\.height/, 'Button must enforce 48 px height');
  assert.match(checkbox, /minHeight:\s*control\.height/, 'Checkbox must enforce 48 px height');
  assert.match(select, /minHeight:\s*control\.height/, 'SelectField must enforce 48 px height');
});

test('shared controls announce state, hints, and validation errors', async () => {
  const [button, checkbox, select, field] = await Promise.all(
    ['Button.tsx', 'Checkbox.tsx', 'SelectField.tsx', 'TextField.tsx'].map(source),
  );
  assert.match(button, /accessibilityState=/);
  assert.match(button, /aria-disabled=/);
  assert.match(checkbox, /accessibilityState=/);
  assert.match(checkbox, /aria-checked=/);
  assert.match(select, /accessibilityState=/);
  assert.match(select, /aria-expanded=/);
  assert.match(field, /accessibilityState=/);
  assert.match(field, /aria-invalid=/);
  assert.match(field, /accessibilityLiveRegion="polite"/);
});

test('status labels remain text plus icon rather than colour only', async () => {
  const tag = await source('StatusTag.tsx');
  assert.match(tag, /Ionicons/);
  assert.match(tag, /<AppText/);
  assert.match(tag, /accessibilityLabel=\{label\}/);
});

test('SurfaceCard does not shield child controls when non-interactive', async () => {
  const card = await source('SurfaceCard.tsx');
  assert.match(card, /if\s*\(!onPress\)\s*return\s*<View\s*style=\{cardStyle\}>\{children\}<\/View>/, 'Non-interactive SurfaceCard must not set accessible={true}');
  assert.match(card, /accessibilityRole="button"/, 'Interactive SurfaceCard must declare button role');
});

test('AppText supports 200% font scaling and Tamil leading clearance', async () => {
  const textComp = await source('AppText.tsx');
  const fonts = await fontSource();
  // M44: with the in-app text size above standard, the phone's own setting is
  // capped at 2 / scale so the two together still reach, and stop at, 200%.
  assert.match(textComp, /maxFontSizeMultiplier=\{2(\s*\/\s*scale)?\}/, 'AppText must allow 200% text scaling');
  assert.match(fonts, /accessibleLineHeight\s*=\s*Math\.ceil\(size\s*\*\s*1\.4/, 'Line height must enforce at least 1.4 ratio');
  assert.match(fonts, /tamilLineHeight/, 'Tamil text must apply dedicated leading ratio');
});
