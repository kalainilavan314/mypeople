import type { SurveyInput, SurveyQuestionInput, SurveyQuestionKind } from '@my-people/api-client';

import { colomboDateTime, readArea, text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the surveys API uses, and the one the dashboard's own checks use too. */
export const SURVEY_REFUSED = 'survey_refused';

export const QUESTION_KINDS: readonly SurveyQuestionKind[] = ['single', 'multiple', 'scale', 'text'];
export const MAX_QUESTIONS = 50;
export const MAX_OPTIONS = 12;
/** The API's option key pattern; "prefer_not_to_say" is kept for sensitive questions. */
export const OPTION_KEY = /^[a-z0-9_]{1,40}$/;
export const PREFER_NOT_TO_SAY = 'prefer_not_to_say';

/** Text written in both languages: each pair is required in Tamil and in English. */
export const SURVEY_PAIRS = [
  { pair: 'title', problem: 'title_required' },
  { pair: 'audience', problem: 'audience_required' },
  { pair: 'privacy', problem: 'privacy_required' },
  { pair: 'nextSteps', problem: 'next_steps_required' },
] as const;

export const SURVEY_TEXT_FIELDS = SURVEY_PAIRS.flatMap(({ pair }) => [`${pair}Ta`, `${pair}En`]);

export const SURVEY_TARGETS: ProblemTargets = {
  title_required: 'titleTa',
  audience_required: 'audienceTa',
  privacy_required: 'privacyTa',
  next_steps_required: 'nextStepsTa',
  anonymous_surveys_cannot_be_edited: 'allowEdits',
  closes_at_invalid: 'closesAt',
  area_required: 'area',
  unknown_area: 'area',
  questions_required: 'questions',
  too_many_questions: 'questions',
  options_required: 'questions',
  option_keys_invalid: 'questions',
  option_text_required: 'questions',
  prompt_required: 'questions',
};

export const KIND_LABELS: Readonly<Record<SurveyQuestionKind, { ta: string; en: string }>> = {
  single: { ta: 'ஒரு தெரிவு', en: 'One choice' },
  multiple: { ta: 'பல தெரிவுகள்', en: 'Several choices' },
  scale: { ta: '1 முதல் 5 வரையான அளவுகோல்', en: 'Scale of 1 to 5' },
  text: { ta: 'எழுத்து மூலமான பதில்', en: 'Written answer' },
};

export const SURVEY_STATE_LABELS: Readonly<Record<'draft' | 'open' | 'closed', { ta: string; en: string }>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  open: { ta: 'திறந்துள்ளது', en: 'Open' },
  closed: { ta: 'மூடப்பட்டது', en: 'Closed' },
};

/** A choice question offers options; a scale is always 1 to 5 and a written answer has none. */
export function hasOptions(kind: SurveyQuestionKind): boolean {
  return kind === 'single' || kind === 'multiple';
}

/** A short option key from its English words: "Once a week" → "once_a_week". */
export function optionKeyFrom(english: string): string {
  return english
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

type Read<T> = { input: T | null; problems: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * The question builder's questions, sent as JSON in one field. Each question is checked here as
 * the API will check it: prompts in both languages, valid unique option keys, both option texts.
 * Problems name the question by its number ("prompt_required:2") so the summary can link to it.
 */
export function parseQuestions(json: string): Read<SurveyQuestionInput[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '[]');
  } catch {
    return { input: null, problems: ['questions_required'] };
  }
  if (!Array.isArray(raw)) return { input: null, problems: ['questions_required'] };
  if (raw.length > MAX_QUESTIONS) return { input: null, problems: ['too_many_questions'] };
  const problems: string[] = [];
  const questions: SurveyQuestionInput[] = raw.map((item, index) => {
    const number = index + 1;
    const entry = isRecord(item) ? item : {};
    const kind = QUESTION_KINDS.find((k) => k === entry.kind) ?? 'single';
    const promptTa = str(entry.promptTa);
    const promptEn = str(entry.promptEn);
    if (!promptTa || !promptEn) problems.push(`prompt_required:${number}`);
    const options = hasOptions(kind)
      ? (Array.isArray(entry.options) ? entry.options : []).slice(0, MAX_OPTIONS).map((option) => {
          const value = isRecord(option) ? option : {};
          return { key: str(value.key), ta: str(value.ta), en: str(value.en) };
        })
      : [];
    const keys = options.map((option) => option.key);
    if (keys.some((key) => !OPTION_KEY.test(key) || key === PREFER_NOT_TO_SAY) || new Set(keys).size !== keys.length) {
      problems.push(`option_keys_invalid:${number}`);
    }
    if (options.some((option) => !option.ta || !option.en)) problems.push(`option_text_required:${number}`);
    return { kind, promptTa, promptEn, options, sensitive: entry.sensitive === true, required: entry.required !== false };
  });
  return { input: problems.length > 0 ? null : questions, problems };
}

/** The API's check before a survey opens: at least one question, two options for each choice question. */
export function questionProblems(questions: readonly { kind: SurveyQuestionKind; options?: readonly unknown[] }[]): string[] {
  const problems: string[] = [];
  if (questions.length === 0) problems.push('questions_required');
  questions.forEach((question, index) => {
    if (hasOptions(question.kind) && (question.options ?? []).length < 2) problems.push(`options_required:${index + 1}`);
  });
  return problems;
}

/**
 * A survey draft: both languages, the area, whether it is anonymous (then answers cannot be
 * edited), an optional closing time and the questions. A draft may have no questions yet; the
 * API checks them when it opens.
 */
export function readSurvey(form: FormLike): Read<SurveyInput> {
  const problems: string[] = [];
  const written: Record<string, string> = {};
  for (const { pair, problem } of SURVEY_PAIRS) {
    written[`${pair}Ta`] = text(form, `${pair}Ta`);
    written[`${pair}En`] = text(form, `${pair}En`);
    if (!written[`${pair}Ta`] || !written[`${pair}En`]) problems.push(problem);
  }
  const anonymous = form.get('anonymous') === '1';
  const allowEdits = form.get('allowEdits') === '1';
  if (anonymous && allowEdits) problems.push('anonymous_surveys_cannot_be_edited');
  const closesText = text(form, 'closesAt');
  const closesAt = closesText ? colomboDateTime(closesText) : null;
  if (closesText && !closesAt) problems.push('closes_at_invalid');
  const area = readArea(text(form, 'area'));
  if (!area) problems.push('area_required');
  const questions = parseQuestions(text(form, 'questionsJson'));
  problems.push(...questions.problems);
  if (problems.length > 0 || !area || !questions.input) return { input: null, problems };
  return {
    input: {
      titleTa: written.titleTa,
      titleEn: written.titleEn,
      audienceTa: written.audienceTa,
      audienceEn: written.audienceEn,
      privacyTa: written.privacyTa,
      privacyEn: written.privacyEn,
      nextStepsTa: written.nextStepsTa,
      nextStepsEn: written.nextStepsEn,
      anonymous,
      allowEdits,
      closesAt,
      area,
      questions: questions.input,
    },
    problems,
  };
}

/** The question a "code:n" problem names, for the summary's link; undefined for other problems. */
export function questionNumberOf(problem: string): number | undefined {
  const [, detail] = problem.split(':', 2);
  const number = Number(detail);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

/**
 * The rows a question's results show: each option (or 1 to 5) with its count, "prefer not to say"
 * for a sensitive question, and for a written answer only how many wrote one, never what they wrote.
 */
export function resultRows(
  question: { kind: SurveyQuestionKind; options: readonly { key: string; ta: string; en: string }[]; sensitive: boolean },
  counts: Readonly<Record<string, number | null>>,
): { key: string; ta: string; en: string; count: number | null }[] {
  const count = (key: string) => (key in counts ? counts[key] : 0);
  const rows =
    question.kind === 'scale'
      ? ['1', '2', '3', '4', '5'].map((key) => ({ key, ta: key, en: key, count: count(key) }))
      : question.kind === 'text'
        ? [{ key: 'text', ta: 'எழுதப்பட்ட பதில்கள்', en: 'Written answers', count: count('text') }]
        : question.options.map((option) => ({ key: option.key, ta: option.ta, en: option.en, count: count(option.key) }));
  if (question.sensitive || PREFER_NOT_TO_SAY in counts) {
    rows.push({ key: PREFER_NOT_TO_SAY, ta: 'சொல்ல விரும்பவில்லை', en: 'Prefer not to say', count: count(PREFER_NOT_TO_SAY) });
  }
  return rows;
}
