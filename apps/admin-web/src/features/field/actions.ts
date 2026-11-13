'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { text, uuidOrNull, type FormState } from '@/lib/formState';

/** D24: a supervisor marks a visit's follow-up done, or reopens it; the API checks field.collect and the area. */
export async function setFollowUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const visitId = uuidOrNull(formData, 'visitId');
  if (!visitId) redirect('/field');
  const done = text(formData, 'done') === '1';
  const failed = await attempt({}, (api) => api.setFieldFollowUp(visitId, done));
  if (failed) return failed;
  redirect(`/field?done=${done ? 'follow_up_done' : 'follow_up_reopened'}${text(formData, 'open') === '1' ? '&open=1' : ''}`);
}
