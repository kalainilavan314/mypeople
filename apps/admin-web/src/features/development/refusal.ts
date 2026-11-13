import { ApiError } from '@my-people/api-client';

import type { FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';

import { stageRefusalCode } from './forms';

/** A refused stage move or proposal moderation, with 403 "forbidden" said as "Your tier cannot record this step". */
export function proposalRefused(error: unknown, values: Record<string, string>): FormState {
  const { code, problems } = failure(error);
  const status = error instanceof ApiError ? error.status : 0;
  return { error: stageRefusalCode(status, code), problems, values, attempt: Date.now() };
}
