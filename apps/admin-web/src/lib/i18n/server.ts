import 'server-only';

import { cookies } from 'next/headers';

import { isSupportedLocale, LOCALE_COOKIE_NAME, type Locale } from './types';

/** Keep the browser's render locale aligned with the authenticated staff preference. */
export async function setAdminLocaleCookie(value: unknown): Promise<boolean> {
  if (!isSupportedLocale(value)) return false;

  const locale: Locale = value;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    maxAge: 365 * 24 * 3600,
    sameSite: 'lax',
    httpOnly: false,
  });
  return true;
}
