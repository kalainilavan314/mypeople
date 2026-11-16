import type { CourseInput, CourseTopic } from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the learning API uses, and the one the dashboard's own checks use too. */
export const LEARNING_REFUSED = 'learning_refused';

export const TOPICS: readonly CourseTopic[] = ['movement', 'civic', 'app', 'skills'];
export const MAX_LESSONS = 50;

export const TOPIC_LABELS: Readonly<Record<CourseTopic, { ta: string; en: string }>> = {
  movement: { ta: 'இயக்கம்', en: 'The movement' },
  civic: { ta: 'குடிமை அறிவு', en: 'Civic knowledge' },
  app: { ta: 'செயலியைப் பயன்படுத்துதல்', en: 'Using the app' },
  skills: { ta: 'திறன்கள்', en: 'Skills' },
};

export const COURSE_STATE_LABELS: Readonly<Record<'draft' | 'published' | 'retired', { ta: string; en: string }>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  published: { ta: 'வெளியிடப்பட்டது', en: 'Published' },
  retired: { ta: 'ஓய்வுபெற்றது', en: 'Retired' },
};

export const COURSE_TEXT_FIELDS = ['titleTa', 'titleEn', 'summaryTa', 'summaryEn'] as const;

export const LEARNING_TARGETS: ProblemTargets = {
  title_required: 'titleTa',
  summary_required: 'summaryTa',
  topic_required: 'topic',
  lessons_required: 'lessons',
  too_many_lessons: 'lessons',
  lesson_text_required: 'lessons',
  lesson_minutes_invalid: 'lessons',
};

type Read<T> = { input: T | null; problems: string[] };
type Lesson = CourseInput['lessons'][number];

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * The lesson builder's lessons, sent as JSON in one field: each needs its title and text in both
 * languages and 1 to 120 minutes. Problems name the lesson by its number ("lesson_text_required:2").
 */
export function parseLessons(json: string): Read<Lesson[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '[]');
  } catch {
    return { input: null, problems: ['lessons_required'] };
  }
  if (!Array.isArray(raw)) return { input: null, problems: ['lessons_required'] };
  if (raw.length > MAX_LESSONS) return { input: null, problems: ['too_many_lessons'] };
  const problems: string[] = [];
  const lessons = raw.map((item, index) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const lesson: Lesson = {
      titleTa: str(entry.titleTa),
      titleEn: str(entry.titleEn),
      bodyTa: str(entry.bodyTa),
      bodyEn: str(entry.bodyEn),
      minutes: Number(entry.minutes),
    };
    if (!lesson.titleTa || !lesson.titleEn || !lesson.bodyTa || !lesson.bodyEn) problems.push(`lesson_text_required:${index + 1}`);
    if (!Number.isInteger(lesson.minutes) || lesson.minutes < 1 || lesson.minutes > 120) problems.push(`lesson_minutes_invalid:${index + 1}`);
    return lesson;
  });
  return { input: problems.length > 0 ? null : lessons, problems };
}

/** A course draft: its title and summary in Tamil and English, its topic, and its lessons in order. */
export function readCourse(form: FormLike): Read<CourseInput> {
  const titleTa = text(form, 'titleTa');
  const titleEn = text(form, 'titleEn');
  const summaryTa = text(form, 'summaryTa');
  const summaryEn = text(form, 'summaryEn');
  const topic = TOPICS.find((item) => item === text(form, 'topic'));
  const lessons = parseLessons(text(form, 'lessonsJson'));
  const problems = [
    ...(titleTa && titleEn ? [] : ['title_required']),
    ...(summaryTa && summaryEn ? [] : ['summary_required']),
    ...(topic ? [] : ['topic_required']),
    ...lessons.problems,
  ];
  if (problems.length > 0 || !topic || !lessons.input) return { input: null, problems };
  return { input: { titleTa, titleEn, summaryTa, summaryEn, topic, lessons: lessons.input }, problems };
}

/** A course is published only with at least one lesson (the API's lessons_required). */
export function canPublish(lessonCount: number): boolean {
  return lessonCount > 0;
}

/** The lesson a "code:n" problem names, for the summary's link. */
export function lessonNumberOf(problem: string): number | undefined {
  const [, detail] = problem.split(':', 2);
  const number = Number(detail);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}
