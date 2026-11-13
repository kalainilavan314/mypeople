import type { IdeaEdits } from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

// D12: a moderator may publish an edited (redacted) version of an idea, for example without a
// private person's name. The limits are the API's (IdeaModerationIn, community.idea).
export const EDITED_TITLE = { min: 5, max: 80 } as const;
export const EDITED_BENEFIT = { min: 10, max: 1000 } as const;

export const IDEA_TARGETS: ProblemTargets = {
  reason_required: 'reason',
  edited_title_length: 'editedTitle',
  edited_benefit_length: 'editedBenefit',
  edits_only_when_publishing: 'editedTitle',
};

function within(value: string, limits: { min: number; max: number }): boolean {
  return value.length >= limits.min && value.length <= limits.max;
}

/** The edited title and benefit, if given; an empty field keeps the author's text. */
export function readIdeaEdits(form: FormLike): { edits: IdeaEdits; problems: string[] } {
  const title = text(form, 'editedTitle');
  const benefit = text(form, 'editedBenefit');
  const problems = [
    ...(title && !within(title, EDITED_TITLE) ? ['edited_title_length'] : []),
    ...(benefit && !within(benefit, EDITED_BENEFIT) ? ['edited_benefit_length'] : []),
  ];
  return { edits: { editedTitle: title || null, editedBenefit: benefit || null }, problems };
}
