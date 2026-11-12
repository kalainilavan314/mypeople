import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closingProblems,
  readChallengeDecision,
  readDistrictDecision,
  readExecutiveDecision,
  readForward,
  readPublicSummary,
} from './forms.ts';
import { changesOwner, detailLines, historyTitle } from './history.ts';
import {
  CASE_STAGES,
  STAGE_LABELS,
  caseAreaKey,
  colomboToday,
  evidenceRefsFrom,
  ownerPermissionsFor,
} from './stages.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const OWNER = '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('community cases is a built module for the case permissions and content moderation, no longer planned', () => {
  const registered = builtModules.find((m) => m.href === '/cases');
  assert.ok(registered);
  assert.match(registered.ta, /[஀-௿]/);
  for (const permission of ['cases.collect', 'cases.research', 'cases.decide_district', 'cases.plan_regional', 'cases.approve_executive', 'cases.implement_and_close', 'content.moderate']) {
    assert.ok(registered.permission.includes(permission), permission);
  }
  assert.equal(plannedModules.some((m) => m.name === 'Community cases'), false);
});

test('every stage has a Tamil label and an English one', () => {
  for (const stage of CASE_STAGES) {
    assert.match(STAGE_LABELS[stage].ta, /[஀-௿]/, stage);
    assert.ok(STAGE_LABELS[stage].en.length > 0, stage);
  }
  assert.equal(STAGE_LABELS.district.en, 'District decision');
});

test('owner lists follow the actions the API allows', () => {
  assert.deepEqual(ownerPermissionsFor('gn', ['fact', 'forward', 'assign']), ['cases.collect', 'cases.research']);
  assert.deepEqual(ownerPermissionsFor('district', ['district_decision']), ['cases.implement_and_close', 'cases.plan_regional']);
  assert.deepEqual(ownerPermissionsFor('ds', ['finding', 'note']), []);
  assert.deepEqual(ownerPermissionsFor('resolved', ['decide_challenge']), [
    'cases.collect',
    'cases.decide_district',
    'cases.implement_and_close',
    'cases.research',
  ]);
});

test('evidence references are one per line, trimmed, at most 20', () => {
  assert.deepEqual(evidenceRefsFrom(' File 12 \r\n\nSite visit photo\n'), ['File 12', 'Site visit photo']);
  assert.equal(evidenceRefsFrom(Array.from({ length: 25 }, (_, i) => `ref ${i}`).join('\n')).length, 20);
});

test('a case is placed at its deepest area', () => {
  assert.equal(caseAreaKey({ gnCode: 'G1', dsCode: 'D1', districtCode: 'LK41', areaPath: [] }), 'gn:G1');
  assert.equal(caseAreaKey({ gnCode: null, dsCode: null, districtCode: 'LK41', areaPath: [] }), 'district:LK41');
  assert.equal(caseAreaKey({ gnCode: null, dsCode: null, districtCode: null, areaPath: ['province:lk4'] }), 'province:lk4');
});

test('the earliest due date is today in Sri Lanka', () => {
  assert.equal(colomboToday(new Date('2026-11-13T19:00:00Z')), '2026-11-14');
  assert.equal(colomboToday(new Date('2026-11-13T10:00:00Z')), '2026-11-13');
});

test('forward needs all three checks and a divisional owner (FR-WEB-017)', () => {
  assert.deepEqual(readForward(form({ locationConfirmed: '1', descriptionClear: '1', note: 'ok' })).problems, [
    'completeness_check_incomplete',
    'owner_required',
  ]);
  const { input } = readForward(form({ locationConfirmed: '1', descriptionClear: '1', evidenceReviewed: '1', ownerId: OWNER, note: 'Checked on site' }));
  assert.deepEqual(input, { locationConfirmed: true, descriptionClear: true, evidenceReviewed: true, ownerId: OWNER, note: 'Checked on site' });
});

test('district decision: act needs authority, resources, office, owner and due date; escalate needs reason and decision', () => {
  assert.deepEqual(readDistrictDecision(form({ decision: 'act', authority: 'Circular 4' })).problems, [
    'resources_required',
    'office_required',
    'due_date_required',
    'owner_required',
  ]);
  assert.deepEqual(readDistrictDecision(form({ decision: 'escalate', reason: 'Beyond budget' })).problems, [
    'reason_and_decision_required',
    'regional_owner_required',
  ]);
  assert.deepEqual(readDistrictDecision(form({})).problems, ['decision_required']);
  const { input } = readDistrictDecision(
    form({ decision: 'escalate', reason: 'Beyond budget', decisionRequired: 'Fund the bridge', regionalOwnerId: OWNER, authority: 'ignored' }),
  );
  assert.deepEqual(input, { decision: 'escalate', reason: 'Beyond budget', decisionRequired: 'Fund the bridge', regionalOwnerId: OWNER });
});

test('executive approval needs every condition; return needs a question; decline a reason (FR-WEB-024)', () => {
  assert.deepEqual(readExecutiveDecision(form({ decision: 'approve', conditions: 'Tender first' })).problems, [
    'conditions_and_implementer_required',
    'scope_and_due_date_required',
    'reporting_duty_required',
  ]);
  assert.deepEqual(readExecutiveDecision(form({ decision: 'return' })).problems, ['question_required']);
  assert.deepEqual(readExecutiveDecision(form({ decision: 'decline', reason: 'Not party work' })).input, { decision: 'decline', reason: 'Not party work' });
});

test('an accepted challenge needs a stage, an owner, a reason, and a due date for implementation (FR-WEB-027)', () => {
  assert.deepEqual(readChallengeDecision(form({ accept: 'accept', stage: 'implementation', ownerId: OWNER, reason: 'Still broken' })).problems, [
    'due_date_required',
  ]);
  assert.deepEqual(readChallengeDecision(form({ accept: 'accept', reason: 'Still broken' })).problems, ['stage_required']);
  assert.deepEqual(readChallengeDecision(form({ accept: 'reject', reason: 'Fixed on 3 Nov' })).input, { accept: false, reason: 'Fixed on 3 Nov' });
  assert.deepEqual(readChallengeDecision(form({ accept: 'accept', stage: 'ds', ownerId: OWNER, reason: 'Recheck', dueDate: '2026-12-01' })).input, {
    accept: true,
    reason: 'Recheck',
    stage: 'ds',
    ownerId: OWNER,
    dueDate: null,
  });
});

test('a public summary needs both languages; withholding needs a reason (BR-032)', () => {
  assert.deepEqual(readPublicSummary(form({ publish: 'publish', titleEn: 'Road repaired', summaryEn: 'The road was repaired.' })).problems, [
    'bilingual_summary_required',
  ]);
  assert.deepEqual(readPublicSummary(form({ publish: 'withhold' })).problems, ['reason_required']);
});

test('a closing report needs evidence and both member summaries (FR-WEB-026)', () => {
  assert.deepEqual(closingProblems(form({ evidenceRefs: ' \n ', summaryEn: 'Done and checked.' }), 0), ['evidence_required', 'bilingual_summary_required']);
  assert.deepEqual(closingProblems(form({ summaryEn: 'Done and checked.', summaryTa: 'முடிக்கப்பட்டது.' }), 1), []);
});

test('history reads Escalated, never Approved, and names report versions (BR-035)', () => {
  assert.equal(historyTitle({ kind: 'escalated', details: { decisionRequired: 'Fund it' } }), 'Escalated');
  assert.doesNotMatch(historyTitle({ kind: 'escalated', details: {} }), /approv/i);
  assert.equal(historyTitle({ kind: 'ds_report', details: { version: 2 } }), 'Divisional report sent to the district (version 2)');
  assert.deepEqual(detailLines({ kind: 'escalated', details: { decisionRequired: 'Fund it' } }), [{ label: 'Decision required', value: 'Fund it' }]);
  assert.deepEqual(detailLines({ kind: 'progress', details: { evidenceRefs: ['File 1', 'File 2'] } }), [{ label: 'Evidence', value: 'File 1\nFile 2' }]);
  assert.equal(changesOwner({ kind: 'note', toStage: null, previousOwnerName: null, newOwnerName: null }), false);
  assert.equal(changesOwner({ kind: 'assigned', toStage: null, previousOwnerName: null, newOwnerName: 'A' }), true);
});

test('case refusals, problems and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('case_refused').ta, /[஀-௿]/);
  for (const problem of [
    'wrong_stage', 'facts_required', 'completeness_check_incomplete', 'owner_not_eligible', 'recommendation_required',
    'authority_required', 'resources_required', 'office_required', 'due_date_required', 'due_date_in_past',
    'reason_and_decision_required', 'conditions_and_implementer_required', 'scope_and_due_date_required', 'question_required',
    'evidence_required', 'bilingual_summary_required', 'already_owner', 'stage_required', 'parent_not_found', 'parent_not_open',
    'cannot_link_to_itself', 'already_moderated', 'photo_not_found', 'no_open_challenge', 'source_required',
  ]) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  assert.equal(bilingualConfirmation('case_escalated').en, 'Escalated to a regional plan.');
});
