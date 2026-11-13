import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PROMISE_TARGETS, STATUSES, STATUS_LABELS, THEMES, THEME_LABELS, UPDATE_STATUSES, evidenceRefs, parseMilestones, pastDue, readDecision, readPromise, readPromiseUpdate } from './forms.ts';
import { totalsBy } from './report.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const PROMISE = {
  titleTa: 'யாழ் வைத்தியசாலை விரிவாக்கம்', titleEn: 'Jaffna hospital extension',
  descriptionTa: 'புதிய சிகிச்சைப் பிரிவு ஒன்றை அமைத்தல்.', descriptionEn: 'Build a new treatment wing.',
  officeTa: 'சுகாதார அமைச்சு', officeEn: 'Ministry of Health',
  targetTa: '50 படுக்கைகள் கொண்ட பிரிவு', targetEn: 'A 50-bed wing in use',
  sourceReference: 'Manifesto 2026, page 12', sourcePublishedOn: '2026-08-01',
  kind: 'government_responsibility', theme: 'health', plannedStart: '2026-12-01', dueDate: '2027-12-31',
  area: 'district:LK41',
  milestonesJson: JSON.stringify([{ titleTa: 'நிலம் ஒதுக்கீடு', titleEn: 'Land allocated', dueDate: '2027-02-01' }]),
};

test('the promise tracker is a built module and no longer planned', () => {
  const registered = builtModules.find((m) => m.href === '/promises');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['promise.edit', 'promise.publish', 'content.moderate']);
  assert.match(registered.ta, /[஀-௿]/);
  assert.equal(plannedModules.some((m) => /promise/i.test(m.name)), false);
  for (const status of STATUSES) assert.match(STATUS_LABELS[status].ta, /[஀-௿]/, status);
  for (const theme of THEMES) assert.match(THEME_LABELS[theme].ta, /[஀-௿]/, theme);
});

test('a promise needs every part in both languages, its source and date, and an area when drafted (FR-PRM-001)', () => {
  const { input, problems } = readPromise(form({ titleEn: 'Hospital', dueDate: '2026-01-01', plannedStart: '2026-06-01' }), { needsArea: true });
  assert.equal(input, null);
  assert.deepEqual(problems, [
    'title_required', 'description_required', 'promise_source_required', 'office_required', 'kind_required', 'theme_required',
    'due_before_start', 'target_required', 'area_required',
  ]);
  for (const problem of problems) assert.ok(targetOf(PROMISE_TARGETS, problem), problem);
  const ok = readPromise(form(PROMISE), { needsArea: true });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.input.area, { level: 'district', code: 'LK41' });
  assert.equal(ok.input.blockersEn, null);
  assert.equal('area' in readPromise(form(PROMISE), { needsArea: false }).input, false, 'the area never changes after drafting');
});

test('milestones need both languages; problems name the milestone', () => {
  assert.deepEqual(parseMilestones(JSON.stringify([{ titleTa: 'நிலம்', titleEn: 'Land' }, { titleTa: '', titleEn: 'Tender' }])).problems, ['milestone_text_required:2']);
  assert.deepEqual(parseMilestones(JSON.stringify([{ titleTa: 'நிலம்', titleEn: 'Land', dueDate: 'soon' }])).input, [{ titleTa: 'நிலம்', titleEn: 'Land', dueDate: null }]);
  assert.equal(targetOf(PROMISE_TARGETS, 'milestone_text_required:2'), 'milestonesJson');
  assert.equal(bilingualProblemText('milestone_text_required:2').en, 'Write milestone 2 in Tamil and English (at least 3 characters).');
});

test('updates: Completed needs evidence; Blocked and Withdrawn need a reason; Delayed cannot be chosen (FR-PRM-002)', () => {
  const note = { noteTa: 'வேலை தொடங்கியது.', noteEn: 'Work started.' };
  assert.deepEqual(readPromiseUpdate(form({ ...note, newStatus: 'completed' })).problems, ['evidence_required']);
  assert.deepEqual(readPromiseUpdate(form({ noteTa: 'நிறுத்தம்', noteEn: 'Stopped', newStatus: 'withdrawn' })).problems, ['reason_required']);
  assert.deepEqual(readPromiseUpdate(form({ noteTa: 'நிதி கிடைக்கவில்லை.', noteEn: 'No funds were released.', newStatus: 'blocked' })).problems, []);
  assert.equal(UPDATE_STATUSES.includes('delayed'), false);
  assert.equal(readPromiseUpdate(form({ ...note, newStatus: 'delayed' })).input.newStatus, null);
  const done = readPromiseUpdate(form({ ...note, newStatus: 'completed', evidenceRefs: ' Gazette 12/2027 \n\n Site photo ', correctsId: '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c' }));
  assert.deepEqual(done.input.evidenceRefs, ['Gazette 12/2027', 'Site photo']);
  assert.equal(done.input.correctsId, '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c');
  assert.equal(evidenceRefs(Array.from({ length: 25 }, (_, i) => `ref ${i}`).join('\n')).length, 20);
});

test('a publication decision is approve, or return with a reason; the requester cannot approve (own_draft)', () => {
  assert.deepEqual(readDecision(form({ decision: 'approve' })).input, { approve: true });
  assert.deepEqual(readDecision(form({ decision: 'return' })).problems, ['reason_required']);
  assert.deepEqual(readDecision(form({})).problems, ['decision_required']);
  assert.match(bilingualMessageFor('own_draft').en, /asked for it to be approved, so you cannot approve it/);
  assert.match(bilingualMessageFor('own_draft').ta, /[஀-௿]/);
});

test('the pages show approvals, feedback moderation, office replies in both languages and the report', async () => {
  const detail = await readSrc('app/(staff)/promises/[id]/page.tsx');
  for (const action of ['decidePublication', 'decideUpdate', 'draftUpdate', 'moderateFeedback', 'replyToFeedback', 'requestPublication']) {
    assert.ok(detail.includes(action), action);
  }
  assert.match(await readSrc('app/(staff)/promises/report/page.tsx'), /getPromiseReport\(\)/);
  assert.match(await readSrc('features/promises/decision.ts'), /Office reply in Tamil/);
});

test('promise refusals and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('promise_refused').ta, /[஀-௿]/);
  for (const problem of ['target_required', 'promise_source_required', 'kind_required', 'theme_required', 'planned_start_required', 'due_before_start', 'milestones_required', 'update_note_required', 'reply_required', 'delayed_is_set_by_due_date', 'published_promises_change_by_update', 'not_published', 'already_decided', 'feedback_not_published']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of ['promise_drafted', 'promise_saved', 'promise_publication_requested', 'promise_published', 'promise_returned', 'promise_update_drafted', 'promise_update_approved', 'promise_update_rejected', 'feedback_published', 'feedback_rejected', 'feedback_replied']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});

test('past the due date only Completed or Withdrawn may be chosen, in Sri Lankan time (overdue_stays_delayed)', () => {
  // 19:00 UTC on 12 November is already 13 November in Sri Lanka.
  assert.equal(pastDue('2026-11-12', new Date('2026-11-12T19:00:00Z')), true);
  assert.equal(pastDue('2026-11-12', new Date('2026-11-12T18:00:00Z')), false);
  assert.equal(targetOf(PROMISE_TARGETS, 'overdue_stays_delayed'), 'newStatus');
  const words = bilingualProblemText('overdue_stays_delayed');
  assert.match(words.ta, /[஀-௿]/);
  assert.match(words.en, /due date has passed/);
});

test('the report adds up per status, area, theme and office; pending work lists promises waiting for publication (D16)', async () => {
  const rows = [
    { status: 'in_progress', theme: 'health', officeEn: 'Ministry of Health', areaKey: 'district:LK41', count: 2 },
    { status: 'delayed', theme: 'health', officeEn: 'Ministry of Health', areaKey: 'district:LK42', count: 3 },
    { status: 'in_progress', theme: 'housing', officeEn: 'Housing Office', areaKey: 'district:LK41', count: 1 },
  ];
  assert.deepEqual(totalsBy(rows, (row) => row.status), [{ key: 'delayed', count: 3 }, { key: 'in_progress', count: 3 }]);
  assert.deepEqual(totalsBy(rows, (row) => row.officeEn), [{ key: 'Ministry of Health', count: 5 }, { key: 'Housing Office', count: 1 }]);
  assert.deepEqual(totalsBy(rows, (row) => row.areaKey), [{ key: 'district:LK41', count: 3 }, { key: 'district:LK42', count: 3 }]);
  const report = await readSrc('app/(staff)/promises/report/page.tsx');
  for (const heading of ['Per status', 'Per area', 'Per theme', 'Per office']) assert.ok(report.includes(heading), heading);
  const list = await readSrc('app/(staff)/promises/page.tsx');
  assert.match(list, /pending\.publications/);
  assert.match(list, /decidePublication/);
  assert.match(bilingualMessageFor('own_draft').en, /drafted/);
});
