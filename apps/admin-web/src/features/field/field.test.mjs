import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { CONCERN_LABELS, countsTable, visitPlaceKey } from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualConfirmation } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('field visits are a built module for field.collect', () => {
  const registered = builtModules.find((m) => m.href === '/field');
  assert.ok(registered);
  assert.equal(registered.permission, 'field.collect');
  for (const concern of Object.keys(CONCERN_LABELS)) assert.match(CONCERN_LABELS[concern].ta, /[஀-௿]/, concern);
});

test('counts by place and concern, including visits without a GN', () => {
  const table = countsTable([
    { areaKey: 'gn:G2', gnCode: 'G2', concern: 'water', visits: 3 },
    { areaKey: 'gn:G1', gnCode: 'G1', concern: 'roads', visits: 2 },
    { areaKey: 'gn:G1', gnCode: 'G1', concern: 'water', visits: 1 },
    { areaKey: 'ds:D1', gnCode: null, concern: 'water', visits: 4 },
  ]);
  assert.deepEqual(table.places, ['ds:D1', 'gn:G1', 'gn:G2']);
  assert.deepEqual(table.concerns, ['water', 'roads']);
  assert.equal(table.count('gn:G2', 'roads'), 0);
  assert.equal(table.count('gn:G1', 'water'), 1);
  assert.equal(table.count('ds:D1', 'water'), 4);
});

test('the place of a visit is its GN, its DS, or none given', () => {
  assert.deepEqual(visitPlaceKey({ gnCode: 'G1', dsCode: null, areaKey: 'gn:G1' }), { key: 'gn:G1', given: true });
  assert.deepEqual(visitPlaceKey({ gnCode: null, dsCode: 'D1', areaKey: 'ds:D1' }), { key: 'ds:D1', given: true });
  assert.deepEqual(visitPlaceKey({ gnCode: null, dsCode: null, areaKey: 'district:LK41' }), { key: 'district:LK41', given: false });
});

test('nothing political is shown; a declined visit shows only its place and time', async () => {
  const page = await readSrc('app/(staff)/field/page.tsx');
  assert.doesNotMatch(page, /votingIntention|politicalPreference|partySupport|persuasion/);
  assert.match(page, /visit\.consent === 'declined' \? \(/);
  assert.match(page, /only the place and time are kept/);
  assert.match(page, /listSupervisedFieldVisits\(openOnly\)/);
  assert.match(bilingualConfirmation('follow_up_done').ta, /[஀-௿]/);
  assert.match(bilingualConfirmation('follow_up_reopened').ta, /[஀-௿]/);
});
