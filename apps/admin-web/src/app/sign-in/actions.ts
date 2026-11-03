'use server';

import { createApiClient } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { setAdminLocaleCookie } from '@/lib/i18n/server';
import { failure } from '@/lib/messages';
import { API_URL, clearStaffTokens, saveStaffTokens, staffApi } from '@/lib/session';

/** S01 on the web: sign in with the staff member's own account; the second factor follows on /mfa. */
export async function signIn(formData: FormData): Promise<void> {
  const route = String(formData.get('route'));
  const number = String(formData.get('number') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');
  if (!API_URL) redirect('/sign-in?error=unavailable');
  let tokens: { token: string; refreshToken: string };
  try {
    const api = createApiClient({ baseUrl: API_URL });
    tokens = route === 'passport' ? await api.signInWithPassport(number, country, password) : await api.signIn(number, password);
  } catch (error) {
    redirect(`/sign-in?error=${failure(error).code}`);
  }
  await saveStaffTokens(tokens.token, tokens.refreshToken);

  // The profile remains available before the second factor is verified. Sync its
  // durable locale now so the MFA page and all following renders use one language.
  try {
    const profile = await (await staffApi()).getMyProfile();
    await setAdminLocaleCookie(profile.language);
  } catch {
    // Sign-in succeeds even if the profile service is temporarily unavailable;
    // MFA repeats this best-effort sync after verification.
  }
  redirect('/mfa');
}

/** Ends the session on the API (every session of the person, as the API does) and forgets both cookies. */
export async function signOut(): Promise<void> {
  try {
    await (await staffApi()).signOut();
  } catch {
    // The cookies are cleared whatever the API answered.
  }
  await clearStaffTokens();
  redirect('/sign-in');
}
