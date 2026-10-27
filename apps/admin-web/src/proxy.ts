import { ApiError, createApiClient, type SessionTokens } from '@my-people/api-client';
import { NextResponse, type NextRequest } from 'next/server';

import { COOKIE_OPTIONS, REFRESH_COOKIE, TOKEN_COOKIE, expiresSoon } from '@/lib/tokens';

const API_URL = process.env.API_URL;

// Renewals by refresh token, shared for a while: the browser sends several
// requests at once (a page and its prefetches) with the same cookies, and a
// refresh token sent twice would end the session as if it had been stolen
// (FR-AUTH-025). This holds for one dashboard process; several would need a
// shared store.
const renewals = new Map<string, Promise<SessionTokens | null>>();
const SHARE_MS = 30_000;

/** New tokens, or null when the API refused the refresh token: the session has ended. */
function renew(baseUrl: string, refreshToken: string): Promise<SessionTokens | null> {
  const shared = renewals.get(refreshToken);
  if (shared) return shared;
  const pending = createApiClient({ baseUrl })
    .refreshSession(refreshToken)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) return null;
      renewals.delete(refreshToken); // unreachable: the next request tries again
      throw error;
    });
  renewals.set(refreshToken, pending);
  setTimeout(() => renewals.delete(refreshToken), SHARE_MS);
  return pending;
}

/**
 * Renews the 15-minute session token before the page or action runs, so
 * server components and Server Actions read a working one from the cookies.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!API_URL || !refreshToken || (token && !expiresSoon(token))) return NextResponse.next();

  let renewed: SessionTokens | null;
  try {
    renewed = await renew(API_URL, refreshToken);
  } catch {
    return NextResponse.next(); // the API is unreachable; the page says so
  }

  // The request's cookies change too, so this render already sees the outcome.
  if (renewed) {
    request.cookies.set(TOKEN_COOKIE, renewed.token);
    request.cookies.set(REFRESH_COOKIE, renewed.refreshToken);
  } else {
    request.cookies.delete(TOKEN_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
  }
  const response = NextResponse.next({ request: { headers: request.headers } });
  if (renewed) {
    response.cookies.set(TOKEN_COOKIE, renewed.token, COOKIE_OPTIONS);
    response.cookies.set(REFRESH_COOKIE, renewed.refreshToken, COOKIE_OPTIONS);
  } else {
    response.cookies.delete(TOKEN_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.png|favicon.ico).*)'],
};
