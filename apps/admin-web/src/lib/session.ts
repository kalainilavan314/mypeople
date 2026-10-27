import 'server-only';

import { createApiClient, type ApiClient } from '@my-people/api-client';
import { cookies, headers } from 'next/headers';

import { COOKIE_OPTIONS, REFRESH_COOKIE, TOKEN_COOKIE } from './tokens';

export const API_URL = process.env.API_URL;

export async function readStaffToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function saveStaffTokens(token: string, refreshToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, COOKIE_OPTIONS);
  jar.set(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
}

export async function clearStaffTokens(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(REFRESH_COOKIE);
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
