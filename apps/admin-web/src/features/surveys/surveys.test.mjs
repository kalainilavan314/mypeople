import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  SURVEY_TARGETS,
  optionKeyFrom,
  parseQuestions,
  questionNumberOf,
  questionProblems,
  readSurvey,
  resultRows,
} from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const TEXT = {
  titleTa: 'நூலகத் தேவைகள்', titleEn: 'Library needs',
  audienceTa: 'யாழ் உறுப்பினர்கள்', audienceEn: 'Jaffna members',
  privacyTa: 'பதில்கள் எண்ணிக்கையாக மட்டுமே காட்டப்படும்.', privacyEn: 'Answers are shown only as counts.',
  nextStepsTa: 'முடிவுகள் மாவட்டக் குழுவுக்கு அனுப்பப்படும்.', nextStepsEn: 'Results go to the district team.',
};

const QUESTION = {
  kind: 'single',
  promptTa: 'எத்தனை தடவை?',
  promptEn: 'How often?',
  options: [
    { key: 'weekly', ta: 'வாரந்தோறும்', en: 'Weekly' },
    { key: 'monthly', ta: 'மாதந்தோறும்', en: 'Monthly' },
  ],
  sensitive: false,
  required: true,
};

test('surveys is a built module for surveys.manage', () => {
  const registered = builtModules.find((m) => m.href === '/surveys');
  assert.ok(registered);
  assert.equal(registered.permission, 'surveys.manage');
  assert.equal(registered.ta, 'கருத்துக்கணிப்புகள்');
});

test('a survey needs its texts in both languages and an area; an anonymous survey cannot allow edits', () => {
  const { input, problems } = readSurvey(form({ titleEn: 'Library needs', anonymous: '1', allowEdits: '1', closesAt: 'soon' }));
  assert.equal(input, null);
  assert.deepEqual(problems, [
    'title_required', 'audience_required', 'privacy_required', 'next_steps_required',
    'anonymous_surveys_cannot_be_edited', 'closes_at_invalid', 'area_required',
  ]);
  assert.equal(SURVEY_TARGETS.anonymous_surveys_cannot_be_edited, 'allowEdits');
  for (const problem of problems) assert.ok(SURVEY_TARGETS[problem], `${problem} points at a field`);
});

test('a complete draft becomes the API input; a draft may have no questions yet', () => {
  const empty = readSurvey(form({ ...TEXT, area: 'district:LK41', questionsJson: '[]' }));
  assert.deepEqual(empty.problems, []);
  assert.deepEqual(empty.input.questions, []);
  const { input } = readSurvey(form({ ...TEXT, area: 'district:LK41', anonymous: '1', closesAt: '2026-12-31T17:00', questionsJson: JSON.stringify([QUESTION]) }));
  assert.equal(input.anonymous, true);
  assert.equal(input.allowEdits, false);
  assert.equal(input.closesAt, '2026-12-31T11:30:00.000Z');
  assert.deepEqual(input.area, { level: 'district', code: 'LK41' });
  assert.deepEqual(input.questions, [QUESTION]);
});

test('questions are checked as the API checks them, each problem naming its question', () => {
  const { problems } = parseQuestions(
    JSON.stringify([
      { ...QUESTION, promptTa: '' },
      { ...QUESTION, options: [{ key: 'Bad Key', ta: 'அ', en: 'A' }, { key: 'prefer_not_to_say', ta: 'ஆ', en: '' }] },
      { kind: 'scale', promptTa: 'மதிப்பீடு', promptEn: 'Rate it', options: [{ key: 'x', ta: '', en: '' }], sensitive: true, required: false },
    ]),
  );
  assert.deepEqual(problems, ['prompt_required:1', 'option_keys_invalid:2', 'option_text_required:2']);
  const scale = parseQuestions(JSON.stringify([{ kind: 'scale', promptTa: 'மதிப்பீடு', promptEn: 'Rate it', options: [{ key: 'x' }] }]));
  assert.deepEqual(scale.input[0].options, [], 'a scale has no options');
  assert.deepEqual(parseQuestions('not json').problems, ['questions_required']);
  assert.deepEqual(parseQuestions(JSON.stringify(Array.from({ length: 51 }, () => QUESTION))).problems, ['too_many_questions']);
});

test('before opening: at least one question and two options for each choice question', () => {
  assert.deepEqual(questionProblems([]), ['questions_required']);
  assert.deepEqual(questionProblems([{ kind: 'multiple', options: [{}] }, { kind: 'text' }]), ['options_required:1']);
  assert.equal(targetOf(SURVEY_TARGETS, 'options_required:3'), 'questions');
  assert.equal(questionNumberOf('options_required:3'), 3);
  assert.equal(questionNumberOf('questions_required'), undefined);
});

test('option keys are made from the English words', () => {
  assert.equal(optionKeyFrom('Once a week!'), 'once_a_week');
  assert.equal(optionKeyFrom('  '), '');
});

test('results are counts only: "fewer than 10" stays null, written answers are only counted', () => {
  assert.deepEqual(resultRows(QUESTION, { weekly: 12, monthly: null }).map((row) => [row.key, row.count]), [
    ['weekly', 12],
    ['monthly', null],
  ]);
  const text = resultRows({ kind: 'text', options: [], sensitive: true }, { text: 15, prefer_not_to_say: null });
  assert.deepEqual(text.map((row) => [row.en, row.count]), [['Written answers', 15], ['Prefer not to say', null]]);
  assert.deepEqual(resultRows({ kind: 'scale', options: [], sensitive: false }, { 5: 20 }).map((row) => row.count), [0, 0, 0, 0, 20]);
});

test('the pages explain anonymous answers and show "fewer than 10", never free text', async () => {
  const formSource = await readSrc('features/surveys/SurveyForm.tsx');
  assert.match(formSource, /Answers are stored with no link to the member\. An anonymous survey cannot allow edits\./);
  assert.match(formSource, /disabled=\{anonymous\}/);
  const results = await readSrc('app/(staff)/surveys/[id]/results/page.tsx');
  assert.match(results, /countText\(/);
  assert.match(results, /Written answers are\s+counted here, never shown/);
  assert.doesNotMatch(results, /answers\.map|\.answerText|freeText/);
  const builder = await readSrc('features/surveys/QuestionBuilder.tsx');
  for (const label of ['Move question', 'Remove question', '+ Add option', '+ Add question', 'Sensitive', 'Answer required']) {
    assert.ok(builder.includes(label), label);
  }
});

test('survey refusals, problems and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('survey_refused').ta, /[஀-௿]/);
  for (const problem of [
    'anonymous_surveys_cannot_be_edited', 'questions_required', 'options_required:2', 'option_keys_invalid:4', 'only_drafts_change',
    'unknown_area', 'prompt_required:1', 'option_text_required:1', 'audience_required', 'privacy_required', 'next_steps_required',
  ]) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  assert.equal(bilingualProblemText('options_required:2').en, 'Question 2 needs at least two options.');
  assert.match(bilingualProblemText('not_allowed_from:closed').en, /closed/);
  for (const done of ['survey_created', 'survey_saved', 'survey_open', 'survey_closed']) assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
});
