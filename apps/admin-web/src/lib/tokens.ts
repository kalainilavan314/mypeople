// The staff member's two API tokens live only in HttpOnly cookies on the
// dashboard's own origin: browser scripts cannot read them, and they are sent
// only with same-site requests (SameSite=Strict), so another site cannot make
// a staff browser act or open evidence. The API still checks the session, the
// second factor and the permission on every call.
//
// The session token lasts 15 minutes; src/proxy.ts renews it with the refresh
// token before a page renders (FR-AUTH-025). Shared by session.ts and the proxy.
export const TOKEN_COOKIE = 'mp_staff';
export const REFRESH_COOKIE = 'mp_staff_refresh';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 12 * 60 * 60, // a working day; the API session may end sooner
} as const;

/** True when the token has run out or will within a minute, judged by its own exp claim. */
export function expiresSoon(token: string, now = Date.now()): boolean {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { exp?: unknown };
    return typeof exp === 'number' && exp * 1000 < now + 60_000;
  } catch {
    return false; // not a token the dashboard can read; the API decides
  }
}
