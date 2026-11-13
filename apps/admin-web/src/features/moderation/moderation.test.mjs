import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PROPOSAL_TARGETS, readModeration } from '../development/forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('the moderation queue is a built module for content.moderate', () => {
  const registered = builtModules.find((m) => m.href === '/moderation');
  assert.ok(registered);
  assert.equal(registered.permission, 'content.moderate');
  assert.equal(registered.ta, 'நடுவர் வரிசை');
  assert.equal(registered.en, 'Moderation queue');
});

test('publishing needs nothing more; rejecting needs the reason the author is told', () => {
  assert.deepEqual(readModeration(form({ publish: '1' })).input, { publish: true, reason: null });
  assert.deepEqual(readModeration(form({ publish: '0' })).problems, ['reason_required']);
  assert.deepEqual(readModeration(form({ publish: '0', reason: 'Names a private person' })).input, { publish: false, reason: 'Names a private person' });
  assert.deepEqual(readModeration(form({})).problems, ['decision_required']);
  assert.equal(PROPOSAL_TARGETS.reason_required, 'reason');
});

test('the queue lists ideas and proposals oldest first and sends cases to the case files', async () => {
  const page = await readSrc('app/(staff)/moderation/page.tsx');
  assert.match(page, /listPendingIdeas\(\)/);
  assert.match(page, /listManagedProposals\(\{ stage: \['pending_moderation'\] \}\)/);
  assert.match(page, /oldestFirst\(/);
  assert.match(page, /href="\/cases\?stage=resolved"/);
  assert.match(page, /moderated inside each case file/);
});

test('no section pretends misinformation reports exist yet', async () => {
  assert.doesNotMatch(await readSrc('app/(staff)/moderation/page.tsx'), /misinformation/i);
});

test('moderation refusals and confirmations have Tamil and English words', () => {
  for (const code of ['idea_refused', 'proposal_refused', 'own_record', 'outside_your_area']) {
    assert.match(bilingualMessageFor(code).ta, /[஀-௿]/, code);
  }
  for (const problem of ['reason_required', 'already_moderated']) assert.match(bilingualProblemText(problem).ta, /[஀-௿]/, problem);
  for (const done of ['idea_published', 'idea_rejected', 'proposal_review', 'proposal_rejected']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
