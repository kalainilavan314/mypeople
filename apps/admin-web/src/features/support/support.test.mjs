import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { CATEGORIES, CATEGORY_LABELS, OUTCOMES, OUTCOME_LABELS, SUPPORT_TARGETS, criteriaOptions, queueOrder, readAppealDecision, readDecision, readDelivery, readIntake, readPartner, readProgramme } from './forms.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const CRITERIA = '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

test('community support is a built module for the assistance permissions, no longer planned', () => {
  const registered = builtModules.find((m) => m.href === '/support');
  assert.ok(registered);
  assert.equal(registered.ta, 'சமூக உதவி');
  assert.equal(registered.en, 'Community support');
  assert.deepEqual([...registered.permission], ['assistance.intake', 'assistance.casework', 'assistance.decide', 'assistance.programme.manage']);
  assert.equal(plannedModules.some((m) => /assistance/i.test(m.name)), false);
  for (const category of CATEGORIES) assert.match(CATEGORY_LABELS[category].ta, /[஀-௿]/, category);
  for (const outcome of OUTCOMES) assert.match(OUTCOME_LABELS[outcome].ta, /[஀-௿]/, outcome);
});

test('intake needs consent first, and a partner referral names the partner (FR-AST-004)', () => {
  const { problems } = readIntake(form({ channel: 'partner', phone: '12', area: 'province:NP' }));
  assert.deepEqual(problems, ['consent_required', 'category_required', 'case_summary_required', 'full_name_required', 'phone_invalid', 'area_required', 'partner_required']);
  for (const problem of problems) assert.ok(targetOf(SUPPORT_TARGETS, problem), problem);
  const { input } = readIntake(form({ consent: '1', channel: 'hotline', category: 'food', summary: 'No food for three days.', fullName: 'K. Selvi', area: 'gn:G12', emergency: '1' }));
  assert.deepEqual(input, {
    category: 'food', summary: 'No food for three days.', emergency: true, consent: true, fullName: 'K. Selvi', phone: null, household: null,
    area: { level: 'gn', code: 'G12' }, channel: 'hotline', partnerId: null,
  });
});

test('nothing about membership, verification or politics is asked or shown', async () => {
  const sources = await Promise.all(['features/support/IntakeForm.tsx', 'app/(staff)/support/[id]/page.tsx', 'app/(staff)/support/page.tsx'].map(readSrc));
  // Field names that would carry membership, identity or political data; the API sends none of them.
  for (const source of sources) assert.doesNotMatch(source, /memberCode|membershipState|membershipNumber|identityVerified|verificationState|partyMember|politicalSupport|voterId/);
});

test('emergencies come first in the queue, then the oldest', () => {
  const order = queueOrder([
    { id: 'a', emergency: false, createdAt: '2026-11-01T00:00:00Z' },
    { id: 'b', emergency: true, createdAt: '2026-11-03T00:00:00Z' },
    { id: 'c', emergency: false, createdAt: '2026-10-01T00:00:00Z' },
  ]);
  assert.deepEqual(order.map((item) => item.id), ['b', 'c', 'a']);
});

test('a decision cites a criteria version with reasons in both languages; deliveries are complete', () => {
  assert.deepEqual(readDecision(form({ outcome: 'approved', reasonEn: 'Meets the criteria.' })).problems, ['criteria_version_required', 'reason_required']);
  assert.deepEqual(readDecision(form({ outcome: 'approved', criteriaVersionId: CRITERIA, reasonTa: 'நிபந்தனைகளைப் பூர்த்தி செய்கிறது.', reasonEn: 'Meets the criteria.' })).problems, []);
  assert.deepEqual(readDelivery(form({ kind: 'Dry rations', amount: '1 pack' })).problems, ['delivery_incomplete']);
  assert.deepEqual(criteriaOptions([
    { nameEn: 'Food relief', nameTa: 'உணவு நிவாரணம்', active: true, criteriaVersionId: CRITERIA, criteriaVersion: 2 },
    { nameEn: 'Old', nameTa: 'பழையது', active: false, criteriaVersionId: CRITERIA, criteriaVersion: 1 },
    { nameEn: 'New', nameTa: 'புதியது', active: true, criteriaVersionId: null, criteriaVersion: null },
  ]), [{ value: CRITERIA, label: 'உணவு நிவாரணம் · Food relief (criteria v2)' }]);
});

test('an appeal is upheld with a reason, or changed with a new outcome, criteria and Tamil reason (FR-AST-011)', () => {
  assert.deepEqual(readAppealDecision(form({ change: 'uphold', reason: 'short' })).problems, ['appeal_reason_required']);
  assert.deepEqual(readAppealDecision(form({ change: 'change', reason: 'New income evidence received.' })).problems, ['new_decision_required']);
  assert.deepEqual(readAppealDecision(form({ change: 'uphold', reason: 'The criteria were applied correctly.' })).input, { change: false, reason: 'The criteria were applied correctly.' });
  assert.match(bilingualMessageFor('original_decider').en, /someone else/);
});

test('programmes need both languages and a kind of help; partners need a kind and contact', () => {
  assert.deepEqual(readProgramme(form({ nameTa: 'உணவு', nameEn: 'Food', descriptionTa: 'உணவு நிவாரணத் திட்டம்', descriptionEn: 'Food relief programme' })).problems, ['categories_required']);
  assert.deepEqual(readProgramme(form({ nameTa: 'உணவு', nameEn: 'Food', descriptionTa: 'உணவு நிவாரணத் திட்டம்', descriptionEn: 'Food relief programme', categories: ['food', 'bogus'] })).input.categories, ['food']);
  assert.deepEqual(readPartner(form({ name: 'Red Cross', kind: 'ngo' })).problems, ['partner_details_required']);
});

test('a case opens only for its caseworker and deciders: "not_assigned" explains it and says it is logged', async () => {
  const page = await readSrc('app/(staff)/support/[id]/page.tsx');
  assert.match(page, /error\.code === 'not_assigned'/);
  assert.match(page, /recorded in the audit log/);
  assert.match(page, /never a reason to refuse help/);
  assert.match(bilingualMessageFor('not_assigned').ta, /[஀-௿]/);
  const statistics = await readSrc('app/(staff)/support/statistics/page.tsx');
  assert.match(statistics, /countText\(cell\.count\)/);
});

test('support refusals and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('support_refused').ta, /[஀-௿]/);
  for (const problem of ['consent_required', 'category_required', 'case_summary_required', 'full_name_required', 'phone_invalid', 'channel_required', 'partner_required', 'partner_not_found', 'partner_consent_required', 'caseworker_required', 'caseworker_not_eligible', 'not_a_suggested_duplicate', 'case_note_required', 'criteria_version_required', 'delivery_incomplete', 'close_note_required', 'new_decision_required', 'appeal_reason_required', 'programme_text_required', 'categories_required', 'criteria_text_required', 'partner_details_required', 'referral_state_required']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of ['support_intake_recorded', 'support_assigned', 'support_linked', 'support_decided', 'support_delivered', 'support_referred', 'support_referral_updated', 'support_closed', 'support_appeal_upheld', 'support_appeal_changed', 'support_programme_created', 'support_criteria_published', 'support_programme_activated', 'support_programme_retired', 'support_partner_added']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
