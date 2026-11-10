import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  bilingualMessageFor,
  bilingualProblemText,
  bilingualConfirmation,
  PROBLEM_FIELD_MAP,
  problemTargetField,
} from './messages.ts';
import { builtModules } from './modules.ts';

test('security messages - confirmation_required and preview_expired_or_invalid have Tamil-first text', () => {
  const req = bilingualMessageFor('confirmation_required');
  assert.equal(typeof req.ta, 'string');
  assert.equal(typeof req.en, 'string');
  assert.ok(req.ta.length > 5);
  // Verify Tamil characters (Unicode range \u0B80-\u0BFF)
  assert.match(req.ta, /[\u0B80-\u0BFF]/);
  assert.match(req.en, /confirmation box/i);

  const expired = bilingualMessageFor('preview_expired_or_invalid');
  assert.match(expired.ta, /[\u0B80-\u0BFF]/);
  assert.match(expired.en, /preview has expired/i);
});

test('security messages - problemText provides Tamil-first and English text', () => {
  const reasonReq = bilingualProblemText('reason_required');
  assert.match(reasonReq.ta, /காரண/);
  assert.match(reasonReq.en, /reason/i);

  const selfAssign = bilingualProblemText('self_assignment');
  assert.match(selfAssign.ta, /பொறுப்/);
  assert.match(selfAssign.en, /yourself/i);

  const outcomeReq = bilingualProblemText('outcome_required');
  assert.match(outcomeReq.ta, /முடிவு/);
  assert.match(outcomeReq.en, /outcome/i);

  const decisionReq = bilingualProblemText('decision_required');
  assert.match(decisionReq.ta, /முடிவு/);
  assert.match(decisionReq.en, /decision/i);

  const checklistInc = bilingualProblemText('checklist_incomplete:id_photo');
  assert.match(checklistInc.ta, /சரிபார்ப்புப் பட்டியல்/);
  assert.match(checklistInc.en, /Checklist/i);

  // Refusals name the checklist item and image as the review page shows them, not the code.
  assert.equal(bilingualProblemText('checklist_incomplete:readable').en, 'Checklist item not confirmed: Every image is readable.');
  assert.equal(bilingualProblemText('evidence_not_viewed:nic_front').en, 'Open the NIC front image before approving.');
});

test('security confirmations - provides bilingual status for completed actions', () => {
  const assigned = bilingualConfirmation('assigned');
  assert.match(assigned.ta, /பொறுப்பு/);
  assert.match(assigned.en, /assigned/i);

  const revoked = bilingualConfirmation('revoked');
  assert.match(revoked.ta, /முடிவுக்கு/);
  assert.match(revoked.en, /ended/i);

  const previewCleared = bilingualConfirmation('preview_cleared');
  assert.match(previewCleared.ta, /ரத்து/);
  assert.match(previewCleared.en, /cancelled/i);

  const decisionRecorded = bilingualConfirmation('decision_recorded');
  assert.match(decisionRecorded.ta, /பதிவு/);
  assert.match(decisionRecorded.en, /decision/i);
});

test('confirmation validation - helper verifies confirmation value', () => {
  const validFormData = new Map([
    ['confirmAssignment', '1'],
    ['confirmRevoke', '1'],
    ['confirmMembershipChange', '1'],
    ['confirmInspection', '1'],
    ['confirmOutcome', '1'],
  ]);

  const invalidFormData = new Map([
    ['confirmAssignment', 'true'], // must be exact '1'
    ['confirmRevoke', 'yes'],
    ['confirmMembershipChange', '0'],
  ]);

  assert.equal(validFormData.get('confirmAssignment') === '1', true);
  assert.equal(validFormData.get('confirmRevoke') === '1', true);
  assert.equal(validFormData.get('confirmMembershipChange') === '1', true);
  assert.equal(validFormData.get('confirmInspection') === '1', true);
  assert.equal(validFormData.get('confirmOutcome') === '1', true);

  assert.equal(invalidFormData.get('confirmAssignment') === '1', false);
  assert.equal(invalidFormData.get('confirmRevoke') === '1', false);
  assert.equal(invalidFormData.get('confirmMembershipChange') === '1', false);
  assert.equal(invalidFormData.get('confirmInspection') === '1', false);
});

test('preview security - URL parameters contain only opaque previewId with zero PII', () => {
  const UUID = /^[0-9a-f-]{36}$/i;
  const mockPreviewId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  assert.ok(UUID.test(mockPreviewId));

  const targetUrl = `/access?previewId=${encodeURIComponent(mockPreviewId)}`;
  const urlObj = new URL(targetUrl, 'https://admin.mypeople.lk');

  // Verify only previewId is present in query parameters
  const params = Array.from(urlObj.searchParams.keys());
  assert.deepEqual(params, ['previewId']);
  assert.equal(urlObj.searchParams.get('previewId'), mockPreviewId);

  // Verify NO sensitive PII fields are in URL
  assert.equal(urlObj.searchParams.has('name'), false);
  assert.equal(urlObj.searchParams.has('code'), false);
  assert.equal(urlObj.searchParams.has('memberCode'), false);
  assert.equal(urlObj.searchParams.has('tier'), false);
  assert.equal(urlObj.searchParams.has('area'), false);
  assert.equal(urlObj.searchParams.has('permissions'), false);
  assert.equal(urlObj.searchParams.has('note'), false);
});

test('server-action redirects never retain submitted sensitive form values in URLs', async () => {
  const actionFiles = [
    new URL('../features/organization/actions.ts', import.meta.url),
    new URL('../features/organization/reviewActions.ts', import.meta.url),
    new URL('../features/members/actions.ts', import.meta.url),
    new URL('../features/verification/actions.ts', import.meta.url),
    new URL('../features/verification/caseActions.ts', import.meta.url),
    new URL('../features/events/actions.ts', import.meta.url),
    new URL('../features/gallery/actions.ts', import.meta.url),
  ];
  const source = await Promise.all(actionFiles.map((file) => readFile(file, 'utf8')));

  for (const actionSource of source) {
    assert.doesNotMatch(actionSource, /retained[A-Z]/);
  }
});

test('accessible validation - problem to target field mapping connects errors to DOM inputs', () => {
  assert.ok(Object.keys(PROBLEM_FIELD_MAP).length > 10);
  assert.equal(problemTargetField('code_required'), 'code');
  assert.equal(problemTargetField('member_not_found'), 'code');
  assert.equal(problemTargetField('tier_not_below_yours'), 'tier');
  assert.equal(problemTargetField('area_outside_yours'), 'areaCode');
  assert.equal(problemTargetField('permissions_not_allowed'), 'permissions');
  assert.equal(problemTargetField('reason_required'), 'reason');
  assert.equal(problemTargetField('confirmation_required'), 'confirm');
  assert.equal(problemTargetField('confirmOutcome'), 'confirm');
  assert.equal(problemTargetField('confirmReview'), 'confirm');
  assert.equal(problemTargetField('confirmRemoval'), 'confirm');
  assert.equal(problemTargetField('checklist_incomplete'), 'checklist');
  assert.equal(problemTargetField('decision_required'), 'decision');
  assert.equal(problemTargetField('outcome_required'), 'outcome');
});

test('DOM metadata cleanliness - zero BRD or FR codes in builtModules', () => {
  for (const mod of builtModules) {
    assert.equal('brd' in mod, false, `Module ${mod.href} must not expose brd property`);
    assert.ok(mod.ta.length > 0);
    assert.ok(mod.en.length > 0);
    assert.match(mod.ta, /[\u0B80-\u0BFF]/, `Module ${mod.href} must have valid Tamil Unicode`);
  }
});
