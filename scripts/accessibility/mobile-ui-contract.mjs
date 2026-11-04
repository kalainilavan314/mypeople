import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const source = async (name) => readFile(new URL(`packages/mobile-ui/src/components/${name}`, root), 'utf8');

test('interactive shared controls expose a semantic role and a 48 px target', async () => {
  for (const name of ['Button.tsx', 'Checkbox.tsx', 'SelectField.tsx', 'TextField.tsx']) {
    const code = await source(name);
    assert.match(code, /accessibilityRole=/, `${name} needs a semantic accessibility role`);
    assert.match(code, /control\.height/, `${name} needs the shared 48 px control height`);
  }
});

test('shared controls announce state and validation', async () => {
  const [button, checkbox, select, field] = await Promise.all(
    ['Button.tsx', 'Checkbox.tsx', 'SelectField.tsx', 'TextField.tsx'].map(source),
  );
  assert.match(button, /accessibilityState=/);
  assert.match(checkbox, /accessibilityState=/);
  assert.match(select, /accessibilityState=/);
  assert.match(field, /accessibilityLiveRegion="polite"/);
});

test('status labels remain text plus icon rather than colour only', async () => {
  const tag = await source('StatusTag.tsx');
  assert.match(tag, /Ionicons/);
  assert.match(tag, /<AppText/);
  assert.match(tag, /accessibilityLabel=\{label\}/);
});
