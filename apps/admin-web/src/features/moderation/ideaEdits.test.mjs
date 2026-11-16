import test from 'node:test';
import assert from 'node:assert/strict';

import { bilingualProblemText } from '../../lib/messages.ts';
import { IDEA_TARGETS, readIdeaEdits } from './ideaEdits.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('empty edit fields keep the author’s text', () => {
  assert.deepEqual(readIdeaEdits(form({ publish: '1' })), { edits: { editedTitle: null, editedBenefit: null }, problems: [] });
  assert.deepEqual(readIdeaEdits(form({ editedTitle: '   ' })).edits.editedTitle, null);
});

test('an edited version is trimmed and kept within the API limits (D12)', () => {
  const read = readIdeaEdits(form({ editedTitle: '  Street lights on the lane ', editedBenefit: 'Neighbours walk home in the light.' }));
  assert.deepEqual(read, {
    edits: { editedTitle: 'Street lights on the lane', editedBenefit: 'Neighbours walk home in the light.' },
    problems: [],
  });
  assert.deepEqual(readIdeaEdits(form({ editedTitle: 'Ab', editedBenefit: 'Short' })).problems, [
    'edited_title_length',
    'edited_benefit_length',
  ]);
});

test('every refusal about an edited idea points at its field and has Tamil and English words', () => {
  for (const problem of ['edited_title_length', 'edited_benefit_length', 'edits_only_when_publishing']) {
    assert.ok(IDEA_TARGETS[problem], problem);
    const words = bilingualProblemText(problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '));
    assert.notEqual(words.ta, words.en);
  }
});
