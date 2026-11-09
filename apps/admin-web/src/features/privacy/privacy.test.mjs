import test from 'node:test';
import assert from 'node:assert/strict';

import { readOutcomeForm } from './outcomeForm.ts';
import { dueStatus, dueText } from './register.ts';
import { en } from '../../lib/i18n/en.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualMessageFor, problemTargetField } from '../../lib/messages.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('privacy requests is a built module needing privacy.requests.handle (D35)', () => {
  const registered = builtModules.find((m) => m.href === '/privacy');
  assert.ok(registered);
  assert.equal(registered.permission, 'privacy.requests.handle');
  assert.match(registered.ta, /[\u0B80-\u0BFF]/);
});

test('due status counts Sri Lankan calendar days and is overdue from the due moment', () => {
  // Due at 10:00 Sri Lanka time on 20 Nov (04:30 UTC).
  const entry = { state: 'open', dueAt: '2026-11-20T04:30:00Z' };
  assert.deepEqual(dueStatus(entry, new Date('2026-11-17T04:30:00Z')), { kind: 'due', days: 3 });
  assert.deepEqual(dueStatus(entry, new Date('2026-11-20T02:00:00Z')), { kind: 'due', days: 0 });
  assert.deepEqual(dueStatus(entry, new Date('2026-11-20T05:00:00Z')), { kind: 'overdue', days: 0 });
  // 19:00 UTC on 20 Nov is already 21 Nov in Sri Lanka.
  assert.deepEqual(dueStatus(entry, new Date('2026-11-20T19:00:00Z')), { kind: 'overdue', days: 1 });
  assert.deepEqual(dueStatus({ ...entry, state: 'completed' }, new Date('2026-12-30T00:00:00Z')), { kind: 'closed' });
});

test('due status reads in words', () => {
  assert.equal(dueText({ kind: 'overdue', days: 4 }, en.privacy), 'Overdue by 4 days');
  assert.equal(dueText({ kind: 'overdue', days: 1 }, en.privacy), 'Overdue by 1 day');
  assert.equal(dueText({ kind: 'overdue', days: 0 }, en.privacy), 'Overdue today');
  assert.equal(dueText({ kind: 'due', days: 0 }, en.privacy), 'Due today');
  assert.equal(dueText({ kind: 'due', days: 6 }, en.privacy), 'Due in 6 days');
  assert.equal(dueText({ kind: 'closed' }, en.privacy), '');
});

test('an outcome needs completed or refused, a 3 to 2,000 character note and the confirmation', () => {
  assert.deepEqual(readOutcomeForm(form({ outcome: 'refused', note: 'Identity not confirmed', confirm: '1' })).input, {
    outcome: 'refused',
    note: 'Identity not confirmed',
  });
  const { input, problems } = readOutcomeForm(form({ outcome: 'deleted', note: 'ok', confirm: '' }));
  assert.equal(input, null);
  assert.deepEqual(problems, ['outcome_required', 'outcome_note_required', 'confirmation_required']);
  for (const problem of problems) assert.ok(problemTargetField(problem), `${problem} must link to a field`);
});

test('the API refusals of D35 read as words in both languages', () => {
  for (const code of ['already_closed', 'own_record', 'privacy_invalid']) {
    assert.match(bilingualMessageFor(code).ta, /[\u0B80-\u0BFF]/, code);
    assert.notEqual(bilingualMessageFor(code).en, code.replace(/_/g, ' '), code);
  }
});
