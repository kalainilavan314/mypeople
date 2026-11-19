import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATEGORIES,
  CATEGORY_LABELS,
  GUIDE_TARGETS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  STATES,
  STATE_LABELS,
  formValues,
  readFilter,
  readGuideEntry,
  readReason,
  readResolution,
  readReview,
  renameProblems,
} from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const TAMIL = /[஀-௿]/;

test('the livelihood guide is a built module for editors and reviewers, with every label in Tamil', () => {
  const registered = builtModules.find((m) => m.href === '/livelihood');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['guide.edit', 'guide.review']);
  assert.match(registered.ta, TAMIL);
  assert.equal(CATEGORIES.length, 9);
  for (const category of CATEGORIES) assert.match(CATEGORY_LABELS[category].ta, TAMIL, category);
  for (const state of STATES) assert.match(STATE_LABELS[state].ta, TAMIL, state);
  for (const reason of REPORT_REASONS) assert.match(REPORT_REASON_LABELS[reason].ta, TAMIL, reason);
});

test('a draft may be saved incomplete: only the category is needed, and empty fields go as null (D28)', () => {
  const { input, problems } = readGuideEntry(form({ category: 'scholarship', titleEn: 'Mahapola scholarship' }));
  assert.deepEqual(problems, []);
  assert.equal(input.category, 'scholarship');
  assert.equal(input.titleEn, 'Mahapola scholarship');
  assert.equal(input.titleTa, null);
  assert.equal(input.sourceUrl, null);
  assert.equal(input.publishedOn, null);

  const none = readGuideEntry(form({ titleEn: 'No category' }));
  assert.equal(none.input, null);
  assert.deepEqual(none.problems, ['guide_category_required']);
  assert.equal(targetOf(GUIDE_TARGETS, 'guide_category_required'), 'category');
});

test('the source link, the dates and the end date are checked before the API is asked', () => {
  const bad = readGuideEntry(form({ category: 'job', sourceUrl: 'www.example.lk', publishedOn: '2026-11-01', expiresOn: '2026-10-01' }));
  assert.deepEqual(bad.problems, ['guide_source_url_format', 'expires_before_published']);
  const badDate = readGuideEntry(form({ category: 'job', verifiedOn: '01/11/2026' }));
  assert.deepEqual(badDate.problems, ['guide_date_invalid']);
  const good = readGuideEntry(form({ category: 'job', sourceUrl: 'https://www.example.lk/jobs', publishedOn: '2026-11-01', verifiedOn: '2026-11-10', expiresOn: '2026-12-31' }));
  assert.deepEqual(good.problems, []);
  assert.equal(good.input.expiresOn, '2026-12-31');
});

test('a review publishes, or returns with a note; a dismissed report needs a reason (FR-LIV-003, 006)', () => {
  assert.deepEqual(readReview(form({ decision: 'approve' })).input, { approve: true });
  assert.deepEqual(readReview(form({ decision: 'return' })).problems, ['reason_required']);
  assert.deepEqual(readReview(form({ decision: 'return', reason: 'Add the closing date' })).input, { approve: false, note: 'Add the closing date' });
  assert.deepEqual(readReview(form({})).problems, ['decision_required']);
  assert.deepEqual(readResolution(form({ outcome: 'fixed' })).input, { outcome: 'fixed' });
  assert.deepEqual(readResolution(form({ outcome: 'dismissed' })).problems, ['reason_required']);
  assert.deepEqual(readResolution(form({ outcome: 'dismissed', reason: 'Still open' })).input, { outcome: 'dismissed', note: 'Still open' });
  assert.deepEqual(readReason(form({ reason: 'no' })).problems, ['reason_required']);
});

test('the list filter takes a state or the expired entries, and nothing else', () => {
  assert.equal(readFilter('expired'), 'expired');
  assert.equal(readFilter('in_review'), 'in_review');
  assert.equal(readFilter('everything'), undefined);
  assert.equal(readFilter(undefined), undefined);
});

test('an entry fills the form with text only', () => {
  const values = formValues({ category: 'job', titleEn: 'Clerk', titleTa: null, missing: ['x'], openReports: 2 });
  assert.equal(values.titleEn, 'Clerk');
  assert.equal(values.titleTa, '');
  assert.equal('missing' in values, false);
});

test('every refusal the guide API gives has words in both languages', () => {
  const problems = [
    'source_url_required', 'summary_ta_required', 'provider_en_required', 'published_on_required', 'verified_on_in_future',
    'verified_before_published', 'already_expired', 'states_eligibility', 'already_reported', 'already_resolved', 'guide_date_invalid',
    ...renameProblems(['title_ta_required', 'body_en_required']),
  ];
  for (const problem of problems) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, TAMIL, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  assert.deepEqual(renameProblems(['title_ta_required', 'source_url_required']), ['guide_title_ta_required', 'source_url_required']);
  for (const code of ['guide_refused', 'own_entry']) assert.match(bilingualMessageFor(code).ta, TAMIL, code);
  for (const done of ['guide_entry_drafted', 'guide_entry_saved', 'guide_review_requested', 'guide_entry_published', 'guide_entry_returned', 'guide_entry_verified', 'guide_entry_withdrawn', 'guide_report_fixed', 'guide_report_dismissed']) {
    assert.match(bilingualConfirmation(done).ta, TAMIL, done);
  }
});
