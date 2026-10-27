import 'server-only';

import { createApiClient, type ApiClient } from '@my-people/api-client';
import { cookies, headers } from 'next/headers';

// The staff member's API session token lives only in this HttpOnly cookie on
// the dashboard's own origin: browser scripts cannot read it, and it is sent
// only with same-site requests (SameSite=Strict), so another site cannot make
// a staff browser act or open evidence. The API still checks the session, the
// second factor and the permission on every call.
const COOKIE = 'mp_staff';
const MAX_AGE_SECONDS = 12 * 60 * 60; // a working day; the API session may end sooner

export const API_URL = process.env.API_URL;

export async function readStaffToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function saveStaffToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearStaffToken(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The browser's address, so the API's limits and audit log see the person rather than this server. */
async function clientAddress(): Promise<string | undefined> {
  const all = await headers();
  return all.get('x-forwarded-for')?.split(',')[0]?.trim() || all.get('x-real-ip') || undefined;
}

/** An API client acting for the signed-in staff member. */
export async function staffApi(): Promise<ApiClient> {
  if (!API_URL) throw new Error('API_URL is not set');
  const token = await readStaffToken();
  return createApiClient({ baseUrl: API_URL, getToken: () => token, forwardedFor: await clientAddress() });
}
