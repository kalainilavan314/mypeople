import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { CONCERN_LABELS, countsTable } from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualConfirmation } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('field visits are a built module for field.collect', () => {
  const registered = builtModules.find((m) => m.href === '/field');
  assert.ok(registered);
  assert.equal(registered.permission, 'field.collect');
  for (const concern of Object.keys(CONCERN_LABELS)) assert.match(CONCERN_LABELS[concern].ta, /[஀-௿]/, concern);
});

test('counts by GN division and concern', () => {
  const table = countsTable([
    { gnCode: 'G2', concern: 'water', visits: 3 },
    { gnCode: 'G1', concern: 'roads', visits: 2 },
    { gnCode: 'G1', concern: 'water', visits: 1 },
  ]);
  assert.deepEqual(table.gns, ['G1', 'G2']);
  assert.deepEqual(table.concerns, ['water', 'roads']);
  assert.equal(table.count('G2', 'roads'), 0);
  assert.equal(table.count('G1', 'water'), 1);
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
