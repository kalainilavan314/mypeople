'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { APPEAL_REFUSED, readAppealDecision } from './appeals';

/**
 * D12: an appeal against a moderation decision, decided by a moderator over the item's area who
 * neither made the first decision (403 original_moderator) nor wrote the item (403 own_record).
 * Changing the decision publishes the idea or approves the information; the author is told the reason.
 */
export async function decideModerationAppeal(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'appealId');
  if (!id) redirect('/moderation#appeals');
  const values = valuesOf(formData, ['change', 'reason']);
  const { input, problems } = readAppealDecision(formData);
  if (!input) return incomplete(APPEAL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideModerationAppeal(id, input));
  if (failed) return failed;
  redirect(`/moderation?done=${input.change ? 'moderation_appeal_changed' : 'moderation_appeal_upheld'}#appeals`);
}
