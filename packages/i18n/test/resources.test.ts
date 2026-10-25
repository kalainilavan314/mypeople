import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Messages = { [key: string]: string | Messages };

const read = (url: URL) => readFileSync(url, 'utf8');
const ownFile = (name: string) => new URL(`../src/${name}`, import.meta.url);
const pwaFile = (name: string) => new URL(`../../../app/src/core/i18n/${name}`, import.meta.url);

function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') result.set(prefix + key, value);
    else for (const [nested, text] of flatten(value, `${prefix}${key}.`)) result.set(nested, text);
  }
  return result;
}

const load = (name: string) => flatten(JSON.parse(read(ownFile(name))) as Messages);
const english = load('en.json');
const tamil = load('ta.json');

// Gaps that existed when this package was created (24 October 2026). The PWA
// passes English defaults in code for the keys it uses (t('key', 'Default')),
// so members do not see raw keys. New gaps fail this test; when a gap is
// fixed, remove it from known-gaps.json too.
const knownGaps = JSON.parse(read(new URL('./known-gaps.json', import.meta.url))) as {
  missingFromEnglish: string[];
  missingFromTamil: string[];
};

test('the files are identical to the PWA copies', () => {
  for (const name of ['en.json', 'ta.json', 'si.json']) {
    assert.equal(read(ownFile(name)), read(pwaFile(name)), `${name} differs from app/src/core/i18n/${name}`);
  }
});

test('Tamil and English have the same keys, apart from the recorded gaps', () => {
  const missingFromEnglish = [...tamil.keys()].filter((key) => !english.has(key)).sort();
  const missingFromTamil = [...english.keys()].filter((key) => !tamil.has(key)).sort();

  assert.deepEqual(missingFromEnglish, knownGaps.missingFromEnglish);
  assert.deepEqual(missingFromTamil, knownGaps.missingFromTamil);
});

test('Tamil and English use the same placeholders', () => {
  const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
  for (const [key, text] of english) {
    const translated = tamil.get(key);
    if (translated !== undefined) assert.deepEqual(placeholders(translated), placeholders(text), key);
  }
});
