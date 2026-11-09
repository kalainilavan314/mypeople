'use server';

import { redirect } from 'next/navigation';

import { readOutcomeForm } from '@/features/privacy/outcomeForm';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function back(requestId: string, query: string): never {
  redirect(`/privacy/${requestId}?${query}`);
}

/**
 * D35: complete or refuse a data-subject request with a note the member sees (needs
 * privacy.requests.handle). Completing a closure closes the account, so the API refuses the DPO's
 * own request ("own_record"). Only codes go back in the address, never the note.
 */
export async function closePrivacyRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  if (!UUID.test(requestId)) redirect('/privacy');
  const { input, problems } = readOutcomeForm(formData);
  if (!input) back(requestId, `error=privacy_invalid&problems=${encodeURIComponent(problems.join(','))}`);

  try {
    await (await staffApi()).closePrivacyRequest(requestId, input);
  } catch (error) {
    const refusal = failure(error);
    back(requestId, `error=${encodeURIComponent(refusal.code)}&problems=${encodeURIComponent(refusal.problems.join(','))}`);
  }
  back(requestId, `done=request_${input.outcome}`);
}
