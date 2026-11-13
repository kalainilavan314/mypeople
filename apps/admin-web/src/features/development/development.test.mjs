import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { TIER_CANNOT_RECORD, readStageMove, stageRefusalCode } from './forms.ts';
import { needsTable } from './needs.ts';
import { APPROVE, CATEGORIES, CATEGORY_LABELS, MODERATE, NEXT_MOVES, PROPOSAL_STAGES, REVIEW, STAGE_LABELS } from './stages.ts';
import { builtModules } from '../../lib/modules.ts';
import { countText, countTextTa } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('development proposals is a built module for moderation, review and planning approval', () => {
  const registered = builtModules.find((m) => m.href === '/development');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['content.moderate', 'dev.review', 'dev.approve_planning']);
  assert.equal(registered.ta, 'அபிவிருத்தி முன்மொழிவுகள்');
});

test('every stage and category has Tamil and English words', () => {
  for (const stage of PROPOSAL_STAGES) assert.match(STAGE_LABELS[stage].ta, /[஀-௿]/, stage);
  for (const category of CATEGORIES) assert.match(CATEGORY_LABELS[category].ta, /[஀-௿]/, category);
});

test('the next steps match the API: who records each, and which need a reason (FR-DEV-006)', () => {
  const table = Object.fromEntries(
    Object.entries(NEXT_MOVES).map(([stage, moves]) => [stage, moves.map((m) => `${m.to}:${m.permission}:${m.reasonRequired ? 'reason' : '-'}`)]),
  );
  assert.deepEqual(table, {
    pending_moderation: [`review:${MODERATE}:-`, `rejected:${MODERATE}:reason`],
    review: [`approved_for_planning:${APPROVE}:reason`, `not_taken_forward:${REVIEW}:reason`],
    approved_for_planning: [`funding_identified:${APPROVE}:reason`, `not_taken_forward:${APPROVE}:reason`],
    funding_identified: [`implementation:${APPROVE}:-`],
    implementation: [],
    not_taken_forward: [],
    rejected: [],
    withdrawn: [],
  });
});

test('a stage move needs a reason where the API does, and only valid steps are read', () => {
  assert.deepEqual(readStageMove(form({ stage: 'rejected' }), 'pending_moderation').problems, ['reason_required']);
  assert.deepEqual(readStageMove(form({ stage: 'review' }), 'pending_moderation').input, { stage: 'review', reason: null });
  assert.deepEqual(readStageMove(form({ stage: 'approved_for_planning', reason: 'Fits the district plan' }), 'review').input, {
    stage: 'approved_for_planning',
    reason: 'Fits the district plan',
  });
  assert.deepEqual(readStageMove(form({ stage: 'implementation' }), 'review').problems, ['not_allowed_from:review']);
});

test('a 403 "forbidden" on a step is said as "Your tier cannot record this step"', () => {
  assert.equal(stageRefusalCode(403, 'forbidden'), TIER_CANNOT_RECORD);
  assert.equal(stageRefusalCode(403, 'own_record'), 'own_record');
  assert.equal(stageRefusalCode(422, 'proposal_refused'), 'proposal_refused');
  assert.equal(bilingualMessageFor(TIER_CANNOT_RECORD).en, 'Your tier cannot record this step.');
  assert.match(bilingualMessageFor(TIER_CANNOT_RECORD).ta, /[஀-௿]/);
});

test('the needs table shows only categories with cells, and null as "fewer than 10" (FR-DEV-008)', () => {
  const table = needsTable([
    { areaKey: 'district:LK41', category: 'healthcare', count: 14 },
    { areaKey: 'district:LK41', category: 'education', count: null },
    { areaKey: 'ds:DS1', category: 'healthcare', count: 11 },
  ]);
  assert.deepEqual(table.areas, ['district:LK41', 'ds:DS1']);
  assert.deepEqual(table.categories, ['education', 'healthcare']);
  assert.equal(table.count('district:LK41', 'education'), null);
  assert.equal(table.count('ds:DS1', 'education'), undefined);
  assert.equal(countText(null), 'fewer than 10');
  assert.equal(countText(14), '14');
  assert.match(countTextTa(null), /[஀-௿]/);
});

test('no AI content is shown before the AI provider decision; history shows tiers, not names', async () => {
  const detail = await readSrc('app/(staff)/development/[id]/page.tsx');
  const queue = await readSrc('app/(staff)/development/page.tsx');
  assert.match(detail, /AI topic and duplicate suggestions arrive after the AI provider decision \(OD-42\)/);
  assert.match(queue, /AI topic and duplicate suggestions arrive after the AI provider decision \(OD-42\)/);
  assert.doesNotMatch(detail + queue, /suggestedTopic|duplicateOf|aiSuggest/);
  assert.match(detail, /Recorded by Tier \$\{entry\.actorTier\}/);
  assert.doesNotMatch(detail, /actorName/);
});

test('stage confirmations have Tamil and English words', () => {
  for (const move of ['review', 'rejected', 'not_taken_forward', 'approved_for_planning', 'funding_identified', 'implementation']) {
    assert.match(bilingualConfirmation(`proposal_${move}`).ta, /[஀-௿]/, move);
  }
  assert.match(bilingualConfirmation('proposal_approved_for_planning').en, /does not commit funds/);
});
