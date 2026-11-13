import 'server-only';

import { ApiError, type ApiClient } from '@my-people/api-client';

import type { FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

/**
 * Calls the API for a Server Action: null when it worked (the action then redirects), or the
 * refusal for the form with what was typed. `codeFor` lets a module say a refusal in its own words
 * (a 403 "forbidden" on a step the viewer's tier cannot take, a 409 silence period).
 */
export async function attempt(
  values: Record<string, string>,
  call: (api: ApiClient) => Promise<unknown>,
  codeFor?: (status: number, code: string) => string,
): Promise<FormState> {
  try {
    await call(await staffApi());
    return null;
  } catch (error) {
    const { code, problems } = failure(error);
    const status = error instanceof ApiError ? error.status : 0;
    return { error: codeFor ? codeFor(status, code) : code, problems, values, attempt: Date.now() };
  }
}
