import test from 'node:test';
import assert from 'node:assert/strict';

import { APPEAL_STATE_LABELS, ITEM_KIND_LABELS, readAppealDecision } from './appeals.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('an appeal is upheld or changed, always with the reason the author is told (D12)', () => {
  assert.deepEqual(readAppealDecision(form({})).problems, ['decision_required', 'reason_required']);
  assert.deepEqual(readAppealDecision(form({ change: 'change', reason: ' ' })).problems, ['reason_required']);
  assert.deepEqual(readAppealDecision(form({ change: 'uphold', reason: 'Still names a person' })).input, {
    change: false,
    reason: 'Still names a person',
  });
  assert.deepEqual(readAppealDecision(form({ change: 'change', reason: 'Fine as written' })).input, { change: true, reason: 'Fine as written' });
});

test('appeal kinds, states, refusals and confirmations have Tamil and English words', () => {
  for (const label of [...Object.values(ITEM_KIND_LABELS), ...Object.values(APPEAL_STATE_LABELS)]) {
    assert.match(label.ta, /[஀-௿]/);
    assert.ok(label.en.length > 0);
  }
  for (const code of ['appeal_refused', 'original_moderator', 'own_record', 'outside_your_area']) {
    assert.match(bilingualMessageFor(code).ta, /[஀-௿]/, code);
    assert.notEqual(bilingualMessageFor(code).en, code.replace(/_/g, ' '), code);
  }
  for (const problem of ['not_rejected', 'already_appealed', 'already_decided']) {
    assert.match(bilingualProblemText(problem).ta, /[஀-௿]/, problem);
  }
  for (const done of ['moderation_appeal_changed', 'moderation_appeal_upheld', 'addition_redacted']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
