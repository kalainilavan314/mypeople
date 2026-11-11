import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { areaName, permissionName, permissionNames } from '../src/staffTerms.ts';

// The permission codes the API knows: the keys of MATRIX in services/api/app/core/permissions.py.
function apiPermissionCodes(): string[] {
  const source = readFileSync(new URL('../../../services/api/app/core/permissions.py', import.meta.url), 'utf8');
  const matrix = source.slice(source.indexOf('MATRIX:'), source.indexOf('\n}\n', source.indexOf('MATRIX:')));
  return [...matrix.matchAll(/^\s+"([a-z_.]+)":\s*\{/gm)].map((match) => match[1]!);
}

test('every permission the API knows has a Tamil and an English name, and no name is left over', () => {
  const codes = apiPermissionCodes();
  assert.ok(codes.length > 50, `read ${codes.length} codes from permissions.py`);
  assert.deepEqual(Object.keys(permissionNames).sort(), [...codes].sort());
  for (const [code, name] of Object.entries(permissionNames)) {
    assert.match(name.ta, /[\u0B80-\u0BFF]/, `${code} needs a Tamil name`);
    assert.ok(name.en.length > 3 && name.en !== code, `${code} needs an English name`);
  }
});

test('an unknown permission shows its code rather than nothing', () => {
  assert.equal(permissionName('events.checkin_scan', 'en'), 'Check people in at events');
  assert.equal(permissionName('something.new', 'ta'), 'something.new');
});

test('areas show their names, Tamil first when there is one, and their code when there is none', () => {
  const names = new Map([
    ['district:LK41', { nameEn: 'Jaffna', nameTa: 'யாழ்ப்பாணம்' }],
    ['gn:LK4136085', { nameEn: 'Maruthady', nameTa: null }],
  ]);
  assert.equal(areaName({ level: 'district', code: 'LK41' }, names, 'ta'), 'யாழ்ப்பாணம் மாவட்டம்');
  assert.equal(areaName('district:LK41', names, 'en'), 'Jaffna district');
  assert.equal(areaName('gn:LK4136085', names, 'ta'), 'Maruthady கிராம அலுவலர் பிரிவு');
  assert.equal(areaName({ level: 'platform', code: null }, names, 'en'), 'Platform-wide');
  assert.equal(areaName('ds:LK4103', names, 'en'), 'DS division LK4103');
  assert.equal(areaName('district:LK41', undefined, 'en'), 'district LK41');
});
