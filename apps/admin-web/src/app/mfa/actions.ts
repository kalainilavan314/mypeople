'use server';

import { redirect } from 'next/navigation';
import QRCode from 'qrcode';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

export type Enrolment = { secret: string; qrSvg: string } | { error: string } | null;

/**
 * Starts authenticator set-up. The secret goes back to the page in the action's
 * answer only, never in the address, a log or a cookie; the API keeps it
 * encrypted and enables it once a correct code confirms it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state first
export async function startEnrolment(_previous: Enrolment): Promise<Enrolment> {
  try {
    const enrolment = await (await staffApi()).startTotpEnrolment();
    return { secret: enrolment.secret, qrSvg: await QRCode.toString(enrolment.otpauthUri, { type: 'svg', margin: 4 }) };
  } catch (error) {
    return { error: failure(error).code };
  }
}

/** Confirms set-up, or gives the code for this session (NFR-SEC-04). */
export async function giveCode(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim();
  const enrolling = formData.get('enrolling') === '1';
  try {
    const api = await staffApi();
    if (enrolling) await api.confirmTotp(code);
    else await api.verifyMfa(code);
  } catch (error) {
    redirect(`/mfa?error=${failure(error).code}`);
  }
  redirect('/');
}
