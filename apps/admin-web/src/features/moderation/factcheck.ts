import type { MisinfoOutcome } from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the fact-check API uses, and the one the dashboard's own checks use too. */
export const FACTCHECK_REFUSED = 'factcheck_refused';

export const OUTCOMES: readonly MisinfoOutcome[] = ['false', 'misleading', 'accurate', 'not_actionable'];
export const OUTCOME_LABELS: Readonly<Record<MisinfoOutcome, { ta: string; en: string }>> = {
  false: { ta: 'பொய்யானது', en: 'False' },
  misleading: { ta: 'தவறாக வழிநடத்துவது', en: 'Misleading' },
  accurate: { ta: 'சரியானது', en: 'Accurate' },
  not_actionable: { ta: 'நடவடிக்கை எடுக்க முடியாதது', en: 'Not actionable' },
};

export const FACTCHECK_TARGETS: ProblemTargets = {
  outcome_required: 'outcome',
  new_outcome_required: 'outcome',
  factcheck_reason_required: 'reason',
  decision_required: 'change',
};

type Read<T> = { input: T | null; problems: string[] };

/** BR-149: a person decides with an outcome and a reason of at least 10 characters; there is no automatic score. */
export function readMisinfoDecision(form: FormLike): Read<{ outcome: MisinfoOutcome; reason: string }> {
  const outcome = OUTCOMES.find((item) => item === text(form, 'outcome'));
  const reason = text(form, 'reason');
  const problems = [...(outcome ? [] : ['outcome_required']), ...(reason.length >= 10 ? [] : ['factcheck_reason_required'])];
  return problems.length || !outcome ? { input: null, problems } : { input: { outcome, reason }, problems };
}

/** An appeal is upheld, or changed to a new outcome, with a reason; never by the first fact-checker. */
export function readMisinfoAppeal(form: FormLike): Read<{ change: boolean; reason: string; outcome?: MisinfoOutcome }> {
  const choice = text(form, 'change');
  const reason = text(form, 'reason');
  if (choice !== 'uphold' && choice !== 'change') return { input: null, problems: ['decision_required'] };
  if (reason.length < 10) return { input: null, problems: ['factcheck_reason_required'] };
  if (choice === 'uphold') return { input: { change: false, reason }, problems: [] };
  const outcome = OUTCOMES.find((item) => item === text(form, 'outcome'));
  return outcome ? { input: { change: true, reason, outcome }, problems: [] } : { input: null, problems: ['new_outcome_required'] };
}
