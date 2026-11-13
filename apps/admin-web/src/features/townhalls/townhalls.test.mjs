import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { MOVES, STATE_LABELS, TOWNHALL_SILENCE, atTime, readAnswer, readArchive, readModeration, readTownHall, townhallRefusalCode } from './forms.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const PROMISE = '0b5f6a51-2a0c-4d5e-9f6b-6e1c2d3a4b5c';

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const SESSION = {
  titleTa: 'தலைவரிடம் கேளுங்கள்', titleEn: 'Ask the Leader',
  descriptionTa: 'மாவட்ட மக்களுடன் நேரடி உரையாடல்.', descriptionEn: 'A live conversation with the district.',
  speakersTa: 'மாவட்டத் தலைவர்', speakersEn: 'District leader',
  language: 'both', startsAt: '2026-12-05T18:00', endsAt: '2026-12-05T19:30', area: 'district:LK41',
};

test('town halls are a built module for producers and moderators; participatory budgeting stays planned', () => {
  const registered = builtModules.find((m) => m.href === '/town-halls');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['townhall.produce', 'townhall.moderate']);
  assert.ok(plannedModules.some((m) => m.name === 'Participatory budgeting'));
  assert.equal(plannedModules.some((m) => /town hall/i.test(m.name)), false);
  for (const state of Object.keys(MOVES)) assert.match(STATE_LABELS[state].ta, /[஀-௿]/, state);
});

test('a session needs both languages, times and https links only; the stream links are optional', () => {
  const { problems } = readTownHall(form({ titleEn: 'Ask', streamUrl: 'http://example.org', startsAt: '2026-12-05T18:00', endsAt: '2026-12-05T17:00' }), { needsArea: true });
  assert.deepEqual(problems, ['title_required', 'description_required', 'speakers_required', 'language_required', 'ends_before_start', 'https_link_required', 'area_required']);
  const { input } = readTownHall(form(SESSION), { needsArea: true });
  assert.equal(input.startsAt, '2026-12-05T12:30:00.000Z');
  assert.equal(input.streamUrl, null);
  assert.deepEqual(input.area, { level: 'district', code: 'LK41' });
});

test('moves follow the API; a 409 silence period has its own sentence', () => {
  assert.deepEqual(MOVES.draft, ['scheduled', 'cancelled']);
  assert.deepEqual(MOVES.live, ['ended']);
  assert.equal(townhallRefusalCode(409, 'silence_period'), TOWNHALL_SILENCE);
  assert.equal(townhallRefusalCode(422, 'townhall_refused'), 'townhall_refused');
  assert.equal(bilingualMessageFor(TOWNHALL_SILENCE).en, 'An election silence period covers this area and time.');
  assert.match(bilingualMessageFor(TOWNHALL_SILENCE).ta, /[஀-௿]/);
});

test('moderation: approve; merge needs an approved question and a reason; reject needs a reason (FR-THL-005)', () => {
  assert.deepEqual(readModeration(form({ decision: 'approve' })).input, { decision: 'approve' });
  assert.deepEqual(readModeration(form({ decision: 'reject' })).problems, ['reason_required']);
  assert.deepEqual(readModeration(form({ decision: 'merge', reason: 'Same question' })).problems, ['merge_target_required']);
  assert.deepEqual(readModeration(form({ decision: 'merge', reason: 'Same question', mergeInto: PROMISE })).input, { decision: 'merge', reason: 'Same question', mergeInto: PROMISE });
});

test('answers are live with seconds, or written in both languages (FR-THL-006)', () => {
  assert.deepEqual(readAnswer(form({ mode: 'live' })).problems, ['time_required']);
  assert.deepEqual(readAnswer(form({ mode: 'live', atSecond: '3725' })).input, { mode: 'live', atSecond: 3725 });
  assert.deepEqual(readAnswer(form({ mode: 'written', answerEn: 'Yes' })).problems, ['bilingual_answer_required']);
  assert.equal(atTime(3725), '1:02:05');
  assert.equal(atTime(65), '1:05');
});

test('the archive links outcomes to a promise id or a case number', () => {
  const { input } = readArchive(form({ recordingUrl: 'https://video.example/1', outcomesJson: JSON.stringify([{ textTa: 'சாலை சீரமைப்பு', textEn: 'Road repair', promiseId: PROMISE, caseNumber: '' }, { textTa: 'நீர் வழங்கல்', textEn: 'Water supply', promiseId: 'x', caseNumber: 'cs-12' }]) }));
  assert.deepEqual(input.outcomes, [
    { textTa: 'சாலை சீரமைப்பு', textEn: 'Road repair', promiseId: PROMISE, caseNumber: null },
    { textTa: 'நீர் வழங்கல்', textEn: 'Water supply', promiseId: null, caseNumber: 'CS-12' },
  ]);
  assert.deepEqual(readArchive(form({ recordingUrl: 'ftp://x', outcomesJson: JSON.stringify([{ textTa: '', textEn: 'x' }]) })).problems, ['recording_link_https', 'outcome_text_required:1']);
});

test('the form says the streaming provider is still to be chosen', async () => {
  assert.match(await readSrc('features/townhalls/TownHallForm.tsx'), /streaming provider is still to be chosen \(OD-44\)/);
});

test('town hall refusals and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('townhall_refused').ta, /[஀-௿]/);
  for (const problem of ['speakers_required', 'language_required', 'https_link_required', 'legal_review_required', 'merge_target_required', 'merge_target_not_approved', 'question_not_approved', 'time_required', 'bilingual_answer_required', 'recording_link_https', 'outcome_text_required:2']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of ['townhall_created', 'townhall_saved', 'townhall_scheduled', 'townhall_live', 'townhall_ended', 'townhall_cancelled', 'townhall_archived', 'question_approve', 'question_reject', 'question_merge', 'question_answered']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
