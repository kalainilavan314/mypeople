import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/staff/en';
import { errorMessage } from '@/features/staff/errors';

const PROBLEMS: Readonly<Record<string, string>> = en.assisted.problems;

/**
 * S04's words for a refusal: each problem the API listed ("checklist_incomplete:no_copies_kept",
 * "missing:selfie") by its kind, or the refusal's code; anything else as the Staff section says it.
 */
export function assistedProblem(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const kinds = [...new Set(error.problems.map((problem) => problem.split(':')[0]))].filter((kind) => kind in PROBLEMS);
    if (kinds.length > 0) return kinds.map((kind) => t(`s.assisted.problems.${kind}`)).join('\n');
    if (error.code in PROBLEMS) return t(`s.assisted.problems.${error.code}`);
  }
  return errorMessage(t, error);
}

/** Whether the person may run assisted sessions: the grant (OD-04) or identity review rights. */
export function canAssist(permissions: ReadonlySet<string>): boolean {
  return permissions.has('members.assisted_verification') || permissions.has('members.verify');
}
