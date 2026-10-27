'use server';

import { createApiClient } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { API_URL, clearStaffToken, saveStaffToken, staffApi } from '@/lib/session';

/** S01 on the web: sign in with the staff member's own account; the second factor follows on /mfa. */
export async function signIn(formData: FormData): Promise<void> {
  const route = String(formData.get('route'));
  const number = String(formData.get('number') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');
  if (!API_URL) redirect('/sign-in?error=unavailable');
  let token: string;
  try {
    const api = createApiClient({ baseUrl: API_URL });
    const result = route === 'passport' ? await api.signInWithPassport(number, country, password) : await api.signIn(number, password);
    token = result.token;
  } catch (error) {
    redirect(`/sign-in?error=${failure(error).code}`);
  }
  await saveStaffToken(token);
  redirect('/mfa');
}

/** Ends the session on the API (every session of the person, as the API does) and forgets the cookie. */
export async function signOut(): Promise<void> {
  try {
    await (await staffApi()).signOut();
  } catch {
    // The cookie is cleared whatever the API answered.
  }
  await clearStaffToken();
  redirect('/sign-in');
}
