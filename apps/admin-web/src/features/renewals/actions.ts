'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { CERTIFICATE_REFUSED, readIssue, readReason } from './forms';

// D25 (PRM-52 certificate.issue_revoke): issue, revoke and reissue certificates. The API checks the
// permission and the member's area again, never one's own record, and keeps each reason with the
// certificate (the audit log holds codes only).

const detail = (ref: string, done: string) => `/renewals/certificates/${encodeURIComponent(ref)}?done=${done}`;

export async function issueCertificate(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['memberCode', 'kind', 'eventId']);
  const { input, problems } = readIssue(formData);
  if (!input) return incomplete(CERTIFICATE_REFUSED, problems, values);
  let ref = '';
  const failed = await attempt(values, async (api) => {
    ref = (await api.issueCertificate(input.memberCode, input.kind, input.eventId)).certificateRef;
  });
  if (failed) return failed;
  redirect(detail(ref, 'certificate_issued'));
}

/** The certificate then verifies as Revoked; the member is told and sees the reason. */
export async function revokeCertificate(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'certificateId');
  const ref = text(formData, 'certificateRef');
  if (!id || !ref) redirect('/renewals');
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(CERTIFICATE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.revokeCertificate(id, input));
  if (failed) return failed;
  redirect(detail(ref, 'certificate_revoked'));
}

/** A new certificate from the current records; the old one then verifies as Superseded. */
export async function reissueCertificate(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'certificateId');
  if (!id) redirect('/renewals');
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(CERTIFICATE_REFUSED, problems, values);
  let ref = '';
  const failed = await attempt(values, async (api) => {
    ref = (await api.reissueCertificate(id, input)).certificateRef;
  });
  if (failed) return failed;
  redirect(detail(ref, 'certificate_reissued'));
}
