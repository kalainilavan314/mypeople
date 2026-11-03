'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { readStaffToken, staffApi } from '../session';
import { setAdminLocaleCookie } from './server';
import { isSupportedLocale, type Locale } from './types';

/**
 * Server action to switch the administrative portal language.
 * Validates the locale, persists to a durable 1-year cookie,
 * updates the staff member's backend profile in PostgreSQL if signed in,
 * and revalidates the UI tree.
 */
export async function setLanguageAction(formData: FormData): Promise<void> {
  const rawLocale = formData.get('locale');
  const redirectTo = formData.get('redirectTo');

  if (!isSupportedLocale(rawLocale)) {
    throw new Error('invalid_locale: language must be "ta" or "en"');
  }

  const locale: Locale = rawLocale;
  // If the user has a valid staff session, persist their preference to their member profile
  if (await readStaffToken()) {
    const api = await staffApi();
    let updated = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await api.updateProfile({ language: locale });
        updated = true;
        break;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!updated) {
      throw new Error(`failed_to_save_preference: ${lastError instanceof Error ? lastError.message : 'api_error'}`);
    }
  }

  await setAdminLocaleCookie(locale);

  revalidatePath('/', 'layout');

  if (typeof redirectTo === 'string' && redirectTo.startsWith('/')) {
    redirect(redirectTo);
  }
}

/**
 * Direct programmatic switch function for client components.
 */
export async function switchLanguage(locale: Locale, redirectTo?: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupportedLocale(locale)) {
    return { success: false, error: 'invalid_locale' };
  }

  if (await readStaffToken()) {
    try {
      const api = await staffApi();
      let updated = false;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await api.updateProfile({ language: locale });
          updated = true;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      if (!updated) {
        return {
          success: false,
          error: lastErr instanceof Error ? lastErr.message : 'profile_update_failed',
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'profile_update_failed',
      };
    }
  }

  await setAdminLocaleCookie(locale);

  revalidatePath('/', 'layout');

  if (redirectTo && redirectTo.startsWith('/')) {
    redirect(redirectTo);
  }

  return { success: true };
}
