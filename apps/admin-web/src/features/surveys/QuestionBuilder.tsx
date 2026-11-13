'use client';

import type { SurveyQuestionKind } from '@my-people/api-client';
import { useState } from 'react';

import { FieldErrors, fieldId } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { KIND_LABELS, MAX_OPTIONS, MAX_QUESTIONS, QUESTION_KINDS, hasOptions, optionKeyFrom, questionNumberOf } from './forms';

type OptionDraft = { uid: number; key: string; ta: string; en: string; keyEdited: boolean };
type QuestionDraft = {
  uid: number;
  kind: SurveyQuestionKind;
  promptTa: string;
  promptEn: string;
  options: OptionDraft[];
  sensitive: boolean;
  required: boolean;
};

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-card px-3 text-sm font-semibold text-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';
const DANGER =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-error bg-card px-3 text-sm font-semibold text-error hover:bg-error-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error';

// Keys for React only, so a moved question keeps its inputs; never sent to the API.
let lastUid = 0;
function next(): number {
  lastUid += 1;
  return lastUid;
}

function startingQuestions(json: string): QuestionDraft[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '[]');
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const options = Array.isArray(entry.options) ? entry.options : [];
    return {
      uid: next(),
      kind: QUESTION_KINDS.find((kind) => kind === entry.kind) ?? 'single',
      promptTa: String(entry.promptTa ?? ''),
      promptEn: String(entry.promptEn ?? ''),
      options: options.map((option) => {
        const value = (typeof option === 'object' && option !== null ? option : {}) as Record<string, unknown>;
        return { uid: next(), key: String(value.key ?? ''), ta: String(value.ta ?? ''), en: String(value.en ?? ''), keyEdited: true };
      }),
      sensitive: entry.sensitive === true,
      required: entry.required !== false,
    };
  });
}

/** What the API takes for each question: the builder's own ids and key-editing flags left out. */
function serialise(questions: readonly QuestionDraft[]): string {
  return JSON.stringify(
    questions.map((question) => ({
      kind: question.kind,
      promptTa: question.promptTa,
      promptEn: question.promptEn,
      options: hasOptions(question.kind) ? question.options.map(({ key, ta, en }) => ({ key, ta, en })) : [],
      sensitive: question.sensitive,
      required: question.required,
    })),
  );
}

/**
 * The survey's questions: add, remove and reorder them; each in Tamil and English, with options
 * (a key, English and Tamil words) for choice questions, and whether it is sensitive (offers
 * "Prefer not to say") or required. Everything goes to the action as one JSON field.
 */
export function QuestionBuilder({ form, initialJson, state }: { form: string; initialJson: string; state: FormState }) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => startingQuestions(initialJson));
  const problems = state?.problems ?? [];
  const listProblems = problems.filter((problem) => problem === 'questions_required' || problem === 'too_many_questions');

  const update = (uid: number, change: Partial<QuestionDraft>) =>
    setQuestions((all) => all.map((question) => (question.uid === uid ? { ...question, ...change } : question)));
  const move = (index: number, by: -1 | 1) =>
    setQuestions((all) => {
      const target = index + by;
      if (target < 0 || target >= all.length) return all;
      const copy = [...all];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const updateOption = (question: QuestionDraft, uid: number, change: Partial<OptionDraft>) =>
    update(question.uid, { options: question.options.map((option) => (option.uid === uid ? { ...option, ...change } : option)) });

  return (
    <fieldset id={fieldId(form, 'questions')} tabIndex={-1} className="flex flex-col gap-4">
      <legend className="mb-2 text-base font-bold text-text">
        <span lang="ta">கேள்விகள்</span> · Questions ({questions.length})
      </legend>
      <input type="hidden" name="questionsJson" value={serialise(questions)} />
      <p className="text-sm text-muted">
        A draft can be saved without questions. Before it opens, every choice question needs at least two options. Option keys are
        saved with each answer: lowercase letters, digits and _ only.
      </p>
      <FieldErrors id={listProblems.length ? `${form}-questions-error` : undefined} problems={listProblems} />

      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const number = index + 1;
          const own = problems.filter((problem) => questionNumberOf(problem) === number);
          // DOM ids follow the position (server and browser agree on it); React keys follow the uid.
          const base = `${form}-q${number}`;
          return (
            <li
              key={question.uid}
              id={`${form}-question-${number}`}
              tabIndex={-1}
              className={`flex flex-col gap-3 rounded-lg border p-3 sm:p-4 ${own.length ? 'border-error' : 'border-line'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-text">Question {number}</h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move question ${number} up`} className={BUTTON}>
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1}
                    aria-label={`Move question ${number} down`}
                    className={BUTTON}>
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((all) => all.filter((item) => item.uid !== question.uid))}
                    aria-label={`Remove question ${number}`}
                    className={DANGER}>
                    Remove
                  </button>
                </div>
              </div>
              <FieldErrors id={own.length ? `${base}-error` : undefined} problems={own} />

              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${base}-kind`} className="text-sm font-semibold">
                    Kind of answer
                  </label>
                  <select
                    id={`${base}-kind`}
                    value={question.kind}
                    onChange={(event) => update(question.uid, { kind: event.target.value as SurveyQuestionKind })}
                    className={CONTROL}>
                    {QUESTION_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABELS[kind].ta} · {KIND_LABELS[kind].en}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm font-semibold">Settings</span>
                  <div className="flex flex-wrap gap-x-4">
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) => update(question.uid, { required: event.target.checked })}
                        className="size-5"
                      />
                      Answer required
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.sensitive}
                        onChange={(event) => update(question.uid, { sensitive: event.target.checked })}
                        className="size-5"
                      />
                      Sensitive: offers “Prefer not to say”
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${base}-promptTa`} className="text-sm font-semibold">
                    Question in Tamil <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`${base}-promptTa`}
                    lang="ta"
                    value={question.promptTa}
                    onChange={(event) => update(question.uid, { promptTa: event.target.value })}
                    required
                    minLength={3}
                    maxLength={400}
                    className={CONTROL}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${base}-promptEn`} className="text-sm font-semibold">
                    Question in English <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`${base}-promptEn`}
                    lang="en"
                    value={question.promptEn}
                    onChange={(event) => update(question.uid, { promptEn: event.target.value })}
                    required
                    minLength={3}
                    maxLength={300}
                    className={CONTROL}
                  />
                </div>
              </div>

              {hasOptions(question.kind) ? (
                <fieldset className="flex flex-col gap-2 rounded-lg bg-surface p-3">
                  <legend className="text-sm font-semibold">Options ({question.options.length})</legend>
                  {question.options.length < 2 ? (
                    <p className="text-xs font-semibold text-warning">! Add at least two options before the survey opens.</p>
                  ) : null}
                  <ul className="flex flex-col gap-3">
                    {question.options.map((option, optionIndex) => {
                      const optionBase = `${base}-o${optionIndex + 1}`;
                      return (
                        <li key={option.uid} className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`${optionBase}-key`} className="text-xs font-semibold">
                              Key
                            </label>
                            <input
                              id={`${optionBase}-key`}
                              value={option.key}
                              onChange={(event) => updateOption(question, option.uid, { key: event.target.value, keyEdited: true })}
                              required
                              pattern="[a-z0-9_]{1,40}"
                              maxLength={40}
                              autoComplete="off"
                              className={`${CONTROL} font-mono`}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`${optionBase}-ta`} className="text-xs font-semibold">
                              Option {optionIndex + 1} in Tamil
                            </label>
                            <input
                              id={`${optionBase}-ta`}
                              lang="ta"
                              value={option.ta}
                              onChange={(event) => updateOption(question, option.uid, { ta: event.target.value })}
                              required
                              maxLength={160}
                              className={CONTROL}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`${optionBase}-en`} className="text-xs font-semibold">
                              Option {optionIndex + 1} in English
                            </label>
                            <input
                              id={`${optionBase}-en`}
                              lang="en"
                              value={option.en}
                              onChange={(event) =>
                                updateOption(question, option.uid, {
                                  en: event.target.value,
                                  ...(option.keyEdited ? {} : { key: optionKeyFrom(event.target.value) }),
                                })
                              }
                              required
                              maxLength={120}
                              className={CONTROL}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => update(question.uid, { options: question.options.filter((item) => item.uid !== option.uid) })}
                            aria-label={`Remove option ${optionIndex + 1} of question ${number}`}
                            className={DANGER}>
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    disabled={question.options.length >= MAX_OPTIONS}
                    onClick={() =>
                      update(question.uid, { options: [...question.options, { uid: next(), key: '', ta: '', en: '', keyEdited: false }] })
                    }
                    className={`${BUTTON} w-fit`}>
                    + Add option
                  </button>
                </fieldset>
              ) : (
                <p className="text-xs text-muted">
                  {question.kind === 'scale'
                    ? 'Members answer from 1 to 5.'
                    : 'Members write their own answer. Results count written answers; the text is never shown on the results page.'}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={questions.length >= MAX_QUESTIONS}
        onClick={() =>
          setQuestions((all) => [
            ...all,
            { uid: next(), kind: 'single', promptTa: '', promptEn: '', options: [], sensitive: false, required: true },
          ])
        }
        className={`${BUTTON} w-fit`}>
        + Add question
      </button>
    </fieldset>
  );
}
