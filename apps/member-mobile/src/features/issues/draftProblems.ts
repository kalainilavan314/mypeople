import type { IssueDraft } from './draft';
import { LIMITS } from './labels';

export type DraftField = 'category' | 'title' | 'place' | 'description';

/**
 * The fields that would make the API refuse the report (FR-RPT-008), checked before review so
 * each can be shown inline beside its field. The server checks them again.
 */
export function draftProblems(draft: IssueDraft, descriptionMin: number): DraftField[] {
  const problems: DraftField[] = [];
  const title = draft.title.trim();
  const description = draft.description.trim();
  const place = draft.locationText.trim();
  if (!draft.category) problems.push('category');
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) problems.push('title');
  if (draft.locationKind !== 'my_gn' && (place.length < LIMITS.placeMin || place.length > LIMITS.placeMax)) {
    problems.push('place');
  }
  if (description.length < descriptionMin || description.length > LIMITS.descriptionMax) problems.push('description');
  return problems;
}
