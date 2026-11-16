import type { ModerationAppealItemKind, ModerationAppealState } from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

// D12: one appeal against a moderation decision on an idea or on information added to a case,
// decided by a moderator who did not make the first decision. The API checks that again.

/** The refusal code the appeals API uses, and the one the dashboard's own checks use too. */
export const APPEAL_REFUSED = 'appeal_refused';

export const APPEAL_TARGETS: ProblemTargets = {
  decision_required: 'change',
  reason_required: 'reason',
};

export const ITEM_KIND_LABELS: Readonly<Record<ModerationAppealItemKind, { ta: string; en: string }>> = {
  idea: { ta: 'யோசனை', en: 'Idea' },
  addition: { ta: 'சேர்க்கப்பட்ட தகவல்', en: 'Added information' },
};

export const APPEAL_STATE_LABELS: Readonly<Record<ModerationAppealState, { ta: string; en: string }>> = {
  open: { ta: 'முடிவுக்காகக் காத்திருக்கிறது', en: 'Waiting for a decision' },
  upheld: { ta: 'முதல் முடிவு உறுதிசெய்யப்பட்டது', en: 'First decision upheld' },
  changed: { ta: 'முடிவு மாற்றப்பட்டது', en: 'Decision changed' },
};

type Read<T> = { input: T | null; problems: string[] };

/** Uphold the rejection or change it (publish the idea, approve the information), always with the reason the author is told. */
export function readAppealDecision(form: FormLike): Read<{ change: boolean; reason: string }> {
  const choice = text(form, 'change');
  const reason = text(form, 'reason');
  const problems = [
    ...(choice === 'uphold' || choice === 'change' ? [] : ['decision_required']),
    ...(reason.length >= 3 ? [] : ['reason_required']),
  ];
  if (problems.length > 0) return { input: null, problems };
  return { input: { change: choice === 'change', reason }, problems };
}
