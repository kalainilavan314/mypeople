'use server';

import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

/** FR-AUTH-027: confirm a role for another quarter, or revoke it, with a reason kept in the review record. */
export async function reviewGrant(formData: FormData): Promise<void> {
  const id = String(formData.get('assignmentId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(id) || (decision !== 'confirmed' && decision !== 'revoked')) redirect('/access-reviews');

  const confirmed = formData.get('confirmReview') === '1';
  if (!confirmed) {
    redirect('/access-reviews?error=confirmation_required');
  }

  try {
    await (await staffApi()).reviewAssignment(id, decision, reason);
  } catch (error) {
    redirect(`/access-reviews?error=${encodeURIComponent(failure(error).code)}`);
  }
  redirect(`/access-reviews?done=${decision === 'confirmed' ? 'role_confirmed' : 'role_revoked'}`);
}
