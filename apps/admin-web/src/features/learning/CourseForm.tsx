'use client';

import { useActionState, useState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, FieldErrors, TEXTAREA, fieldId } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { createCourse, updateCourse } from './actions';
import { LEARNING_TARGETS, MAX_LESSONS, TOPICS, TOPIC_LABELS, lessonNumberOf } from './forms';

type LessonDraft = { uid: number; titleTa: string; titleEn: string; bodyTa: string; bodyEn: string; minutes: string };

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-card px-3 text-sm font-semibold text-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';
const DANGER =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-error bg-card px-3 text-sm font-semibold text-error hover:bg-error-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error';

// Keys for React only, so a moved lesson keeps its inputs; never sent to the API.
let lastUid = 0;
function next(): number {
  lastUid += 1;
  return lastUid;
}

function startingLessons(json: string): LessonDraft[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '[]');
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return {
      uid: next(),
      titleTa: String(entry.titleTa ?? ''),
      titleEn: String(entry.titleEn ?? ''),
      bodyTa: String(entry.bodyTa ?? ''),
      bodyEn: String(entry.bodyEn ?? ''),
      minutes: String(entry.minutes ?? ''),
    };
  });
}

function serialise(lessons: readonly LessonDraft[]): string {
  return JSON.stringify(
    lessons.map(({ titleTa, titleEn, bodyTa, bodyEn, minutes }) => ({ titleTa, titleEn, bodyTa, bodyEn, minutes: Number(minutes) })),
  );
}

/**
 * A course draft (H15, H16): title and summary in Tamil and English, its topic, and lessons in
 * order. Editing replaces the draft; a published course is retired and replaced, never changed.
 */
export function CourseForm({ courseId, current }: { courseId?: string; current?: Record<string, string> }) {
  const editing = Boolean(courseId);
  const [state, action] = useActionState<FormState, FormData>(editing ? updateCourse : createCourse, null);
  const form = editing ? 'edit' : 'new';
  const values = state?.values ?? current ?? {};

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems
        form={form}
        state={state}
        targets={LEARNING_TARGETS}
        fields={['titleTa', 'summaryTa', 'topic', 'lessons']}
        linkFor={(problem) => {
          const number = lessonNumberOf(problem);
          return number ? `#${form}-lesson-${number}` : undefined;
        }}
      />
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">பாடநெறி</span> · The course, in Tamil and English
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form={form} name="titleTa" label="Title in Tamil" required state={state} targets={LEARNING_TARGETS}>
            {(control) => <input {...control} lang="ta" required minLength={5} maxLength={160} defaultValue={values.titleTa} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="titleEn" label="Title in English" required state={state} targets={LEARNING_TARGETS}>
            {(control) => <input {...control} lang="en" required minLength={5} maxLength={120} defaultValue={values.titleEn} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="summaryTa" label="Summary in Tamil" required state={state} targets={LEARNING_TARGETS}>
            {(control) => <textarea {...control} lang="ta" required minLength={10} maxLength={900} rows={3} defaultValue={values.summaryTa} className={TEXTAREA} />}
          </ActionField>
          <ActionField form={form} name="summaryEn" label="Summary in English" required state={state} targets={LEARNING_TARGETS}>
            {(control) => <textarea {...control} lang="en" required minLength={10} maxLength={600} rows={3} defaultValue={values.summaryEn} className={TEXTAREA} />}
          </ActionField>
        </div>
        <ActionField form={form} name="topic" label="Topic" required state={state} targets={LEARNING_TARGETS}>
          {(control) => (
            <select {...control} required defaultValue={values.topic ?? ''} className={`${CONTROL} md:max-w-sm`}>
              <option value="">Choose a topic</option>
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {TOPIC_LABELS[topic].ta} · {TOPIC_LABELS[topic].en}
                </option>
              ))}
            </select>
          )}
        </ActionField>
      </fieldset>

      <div className="border-t border-line pt-6">
        <LessonBuilder form={form} initialJson={values.lessonsJson ?? '[]'} state={state} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{editing ? 'Save draft' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">Members see the course only once it is published, and it cannot change after that.</p>
      </div>
    </form>
  );
}

/** The lessons in order: add, remove and move them; each in Tamil and English with its minutes. */
function LessonBuilder({ form, initialJson, state }: { form: string; initialJson: string; state: FormState }) {
  const [lessons, setLessons] = useState<LessonDraft[]>(() => startingLessons(initialJson));
  const problems = state?.problems ?? [];
  const listProblems = problems.filter((problem) => problem === 'lessons_required' || problem === 'too_many_lessons');
  const update = (uid: number, change: Partial<LessonDraft>) =>
    setLessons((all) => all.map((lesson) => (lesson.uid === uid ? { ...lesson, ...change } : lesson)));
  const move = (index: number, by: -1 | 1) =>
    setLessons((all) => {
      const target = index + by;
      if (target < 0 || target >= all.length) return all;
      const copy = [...all];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const total = lessons.reduce((sum, lesson) => sum + (Number(lesson.minutes) || 0), 0);

  return (
    <fieldset id={fieldId(form, 'lessons')} tabIndex={-1} className="flex flex-col gap-4">
      <legend className="mb-2 text-base font-bold text-text">
        <span lang="ta">பாடங்கள்</span> · Lessons ({lessons.length}, {total} minutes)
      </legend>
      <input type="hidden" name="lessonsJson" value={serialise(lessons)} />
      <p className="text-sm text-muted">A draft can be saved without lessons; publishing needs at least one.</p>
      <FieldErrors id={listProblems.length ? `${form}-lessons-error` : undefined} problems={listProblems} />

      <ol className="flex flex-col gap-4">
        {lessons.map((lesson, index) => {
          const number = index + 1;
          const own = problems.filter((problem) => lessonNumberOf(problem) === number);
          // DOM ids follow the position (server and browser agree on it); React keys follow the uid.
          const base = `${form}-l${number}`;
          return (
            <li
              key={lesson.uid}
              id={`${form}-lesson-${number}`}
              tabIndex={-1}
              className={`flex flex-col gap-3 rounded-lg border p-3 sm:p-4 ${own.length ? 'border-error' : 'border-line'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-text">Lesson {number}</h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move lesson ${number} up`} className={BUTTON}>
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === lessons.length - 1}
                    aria-label={`Move lesson ${number} down`}
                    className={BUTTON}>
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessons((all) => all.filter((item) => item.uid !== lesson.uid))}
                    aria-label={`Remove lesson ${number}`}
                    className={DANGER}>
                    Remove
                  </button>
                </div>
              </div>
              <FieldErrors id={own.length ? `${base}-error` : undefined} problems={own} />
              <div className="grid gap-3 md:grid-cols-2">
                <LessonInput id={`${base}-titleTa`} label="Lesson title in Tamil" lang="ta" value={lesson.titleTa} min={3} max={160} onChange={(value) => update(lesson.uid, { titleTa: value })} />
                <LessonInput id={`${base}-titleEn`} label="Lesson title in English" lang="en" value={lesson.titleEn} min={3} max={120} onChange={(value) => update(lesson.uid, { titleEn: value })} />
                <LessonInput id={`${base}-bodyTa`} label="Lesson text in Tamil" lang="ta" value={lesson.bodyTa} min={20} max={18000} long onChange={(value) => update(lesson.uid, { bodyTa: value })} />
                <LessonInput id={`${base}-bodyEn`} label="Lesson text in English" lang="en" value={lesson.bodyEn} min={20} max={12000} long onChange={(value) => update(lesson.uid, { bodyEn: value })} />
              </div>
              <div className="flex flex-col gap-1 md:max-w-48">
                <label htmlFor={`${base}-minutes`} className="text-sm font-semibold">
                  Minutes <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`${base}-minutes`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  required
                  value={lesson.minutes}
                  onChange={(event) => update(lesson.uid, { minutes: event.target.value })}
                  className={CONTROL}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={lessons.length >= MAX_LESSONS}
        onClick={() => setLessons((all) => [...all, { uid: next(), titleTa: '', titleEn: '', bodyTa: '', bodyEn: '', minutes: '5' }])}
        className={`${BUTTON} w-fit`}>
        + Add lesson
      </button>
    </fieldset>
  );
}

function LessonInput({
  id,
  label,
  lang,
  value,
  min,
  max,
  long,
  onChange,
}: {
  id: string;
  label: string;
  lang: 'ta' | 'en';
  value: string;
  min: number;
  max: number;
  long?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label} <span aria-hidden="true">*</span>
      </label>
      {long ? (
        <textarea id={id} lang={lang} value={value} onChange={(event) => onChange(event.target.value)} required minLength={min} maxLength={max} rows={6} className={TEXTAREA} />
      ) : (
        <input id={id} lang={lang} value={value} onChange={(event) => onChange(event.target.value)} required minLength={min} maxLength={max} className={CONTROL} />
      )}
    </div>
  );
}
