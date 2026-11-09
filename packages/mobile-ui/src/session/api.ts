import { ApiError, createApiClient, type ApiClient } from '@my-people/api-client';

import { clearSession, readRefreshToken, readToken, saveTokens } from '../lib/storage';

let client: ApiClient | null = null;
let renewing: Promise<string | null> | null = null;

/** Builds the client once the install's device id is known; the session provider calls this. */
export function configureApi(baseUrl: string, deviceId: string | undefined): ApiClient {
  client = createApiClient({ baseUrl, getToken: readToken, refresh: renewToken, deviceId });
  return client;
}

/** The configured client; screens only run after the session provider has configured it. */
export function api(): ApiClient {
  if (!client) throw new Error('The API address is not configured (EXPO_PUBLIC_API_URL).');
  return client;
}

/**
 * A new 15-minute token from the stored refresh token (FR-AUTH-025), or null when the
 * session has ended. Requests that find their token expired at the same moment share one
 * renewal: a refresh token works once, and sending it twice would end the session as if
 * it had been stolen.
 */
export function renewToken(): Promise<string | null> {
  renewing ??= renew().finally(() => {
    renewing = null;
  });
  return renewing;
}

async function renew(): Promise<string | null> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return null;
  try {
    const renewed = await api().refreshSession(refreshToken);
    await saveTokens(renewed.token, renewed.refreshToken);
    return renewed.token;
  } catch (error) {
    // Refused: the session ended, sat unused for 30 days, or its refresh token was used twice.
    // Anything else (no network) keeps the tokens for the next try.
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
      return null;
    }
    throw error;
  }
}

/** The stored token, renewed first when it has run out or is about to; for requests the client does not make (images). */
export async function freshToken(): Promise<string | null> {
  const token = await readToken();
  return token && expiresSoon(token) ? renewToken() : token;
}

function expiresSoon(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp === 'number' && exp * 1000 < Date.now() + 30_000;
  } catch {
    return false; // not a token the app can read; the API decides
  }
}
