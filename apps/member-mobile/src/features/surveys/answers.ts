import type { SurveyAnswerValue, SurveyDetail, SurveyQuestion } from '@my-people/api-client';
import type { TFunction } from 'i18next';

/** The API's answer for "Prefer not to say", allowed only on sensitive questions (FR-SRV-002). */
export const PREFER_NOT_TO_SAY = 'prefer_not_to_say';

/** The member's answers by question id, kept while they move back and forth. */
export type Answers = Record<string, SurveyAnswerValue>;

/** The questions in the order the survey asks them; the API numbers its problems the same way. */
export function orderedQuestions(survey: SurveyDetail): SurveyQuestion[] {
  return [...survey.questions].sort((a, b) => a.position - b.position);
}

/** The member's earlier answers, when the survey lets them change them. */
export function initialAnswers(survey: SurveyDetail): Answers {
  const saved = survey.myAnswers ?? {};
  const answers: Answers = {};
  for (const question of survey.questions) {
    const value = saved[question.id];
    if (typeof value === 'string' || typeof value === 'number') answers[question.id] = value;
    else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) answers[question.id] = value;
  }
  return answers;
}

export function isAnswered(value: SurveyAnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Only answered questions are sent, and typed answers without stray spaces. */
export function answersToSend(questions: SurveyQuestion[], answers: Answers): Answers {
  const sending: Answers = {};
  for (const question of questions) {
    const value = answers[question.id];
    if (!isAnswered(value) || value === undefined) continue;
    sending[question.id] = typeof value === 'string' ? value.trim() : value;
  }
  return sending;
}

/** An answer in words for the review screen. */
export function answerWords(
  question: SurveyQuestion,
  value: SurveyAnswerValue | undefined,
  localized: (english: string, tamil: string) => string,
  t: TFunction,
): string {
  if (!isAnswered(value) || value === undefined) return t('m.surveys.notAnswered');
  if (value === PREFER_NOT_TO_SAY) return t('m.surveys.preferNotToSay');
  const option = (key: string) => {
    const found = question.options.find((item) => item.key === key);
    return found ? localized(found.en, found.ta) : key;
  };
  if (Array.isArray(value)) return value.map(option).join(', ');
  if (typeof value === 'number') return t('m.surveys.scaleValue', { value });
  return question.kind === 'text' ? value : option(value);
}

/** The question numbers in a refusal such as "answer_required:3", so the member can go to it. */
export function refusedQuestion(problems: readonly string[]): number | null {
  for (const problem of problems) {
    const [kind, number] = problem.split(':');
    if ((kind === 'answer_required' || kind === 'answer_invalid') && Number(number) > 0) return Number(number);
  }
  return null;
}
