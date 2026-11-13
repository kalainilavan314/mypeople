import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { LEARNING_TARGETS, TOPICS, TOPIC_LABELS, canPublish, lessonNumberOf, parseLessons, readCourse } from './forms.ts';
import { builtModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const LESSON = {
  titleTa: 'இயக்கத்தின் வரலாறு',
  titleEn: 'Our history',
  bodyTa: 'இயக்கம் 2020 இல் தொடங்கப்பட்டது. இது மக்களுக்கான இயக்கம்.',
  bodyEn: 'The movement began in 2020 as a people-led movement.',
  minutes: 8,
};

test('learning courses is a built module for content.moderate', () => {
  const registered = builtModules.find((m) => m.href === '/learning');
  assert.ok(registered);
  assert.equal(registered.permission, 'content.moderate');
  assert.equal(registered.ta, 'கற்றல் பாடநெறிகள்');
  for (const topic of TOPICS) assert.match(TOPIC_LABELS[topic].ta, /[஀-௿]/, topic);
});

test('a course needs its title and summary in both languages and a topic; a draft may have no lessons', () => {
  assert.deepEqual(readCourse(form({ titleEn: 'Our movement', lessonsJson: '[]' })).problems, ['title_required', 'summary_required', 'topic_required']);
  const { input, problems } = readCourse(
    form({ titleTa: 'எமது இயக்கம்', titleEn: 'Our movement', summaryTa: 'இயக்கம் பற்றிய அறிமுகம்.', summaryEn: 'An introduction.', topic: 'movement', lessonsJson: '[]' }),
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(input.lessons, []);
  assert.equal(input.topic, 'movement');
});

test('lessons keep their order and need both languages and 1 to 120 minutes', () => {
  const ok = parseLessons(JSON.stringify([LESSON, { ...LESSON, titleEn: 'Second', minutes: '12' }]));
  assert.deepEqual(ok.input.map((lesson) => [lesson.titleEn, lesson.minutes]), [['Our history', 8], ['Second', 12]]);
  const bad = parseLessons(JSON.stringify([LESSON, { ...LESSON, bodyTa: '' }, { ...LESSON, minutes: 0 }, { ...LESSON, minutes: 121 }]));
  assert.deepEqual(bad.problems, ['lesson_text_required:2', 'lesson_minutes_invalid:3', 'lesson_minutes_invalid:4']);
  assert.deepEqual(parseLessons(JSON.stringify(Array.from({ length: 51 }, () => LESSON))).problems, ['too_many_lessons']);
  assert.equal(targetOf(LEARNING_TARGETS, 'lesson_text_required:2'), 'lessons');
  assert.equal(lessonNumberOf('lesson_minutes_invalid:3'), 3);
});

test('publishing needs at least one lesson', async () => {
  assert.equal(canPublish(0), false);
  assert.equal(canPublish(1), true);
  const stateForm = await readSrc('features/learning/CourseStateForm.tsx');
  assert.match(stateForm, /canPublish\(lessons\)/);
  const builder = await readSrc('features/learning/CourseForm.tsx');
  for (const label of ['Move lesson', 'Remove lesson', '+ Add lesson', 'Minutes', 'Lesson text in Tamil', 'Lesson text in English']) {
    assert.ok(builder.includes(label), label);
  }
});

test('learning refusals, problems and confirmations have Tamil and English words', () => {
  assert.match(bilingualMessageFor('learning_refused').ta, /[஀-௿]/);
  for (const problem of ['only_drafts_change', 'lessons_required', 'lesson_text_required:1', 'lesson_minutes_invalid:2', 'topic_required', 'summary_required']) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, /[஀-௿]/, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  assert.match(bilingualProblemText('not_allowed_from:retired').en, /retired/);
  for (const done of ['course_created', 'course_saved', 'course_published', 'course_retired']) assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
});
