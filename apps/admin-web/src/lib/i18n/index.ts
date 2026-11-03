import {
  bilingualConfirmation,
  bilingualMessageFor,
  bilingualProblemText,
} from '../messages.ts';
import { enMessages } from './en.ts';
import { taMessages } from './ta.ts';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
  type TranslationDictionary,
} from './types.ts';

export * from './types.ts';
export { en, enMessages } from './en.ts';
export { ta, taMessages } from './ta.ts';

export type ResolveLocaleOptions = {
  requested?: string | null;
  cookie?: string | null;
  memberLanguage?: string | null;
};

/**
 * Resolves the active locale using the precedence:
 * 1. Explicit requested locale (if supported)
 * 2. Explicit cookie value (admin_locale)
 * 3. Stored staff profile language
 * 4. Default locale ('ta')
 */
export function resolveLocale(
  cookieOrOptions?: string | null | ResolveLocaleOptions,
  staffLocale?: string | null,
): Locale {
  if (cookieOrOptions && typeof cookieOrOptions === 'object') {
    const { requested, cookie, memberLanguage } = cookieOrOptions;
    if (requested && isSupportedLocale(requested)) {
      return requested;
    }
    if (cookie && isSupportedLocale(cookie)) {
      return cookie;
    }
    if (memberLanguage && isSupportedLocale(memberLanguage)) {
      return memberLanguage;
    }
    return DEFAULT_LOCALE;
  }

  const cookieVal = cookieOrOptions;
  if (cookieVal && isSupportedLocale(cookieVal)) {
    return cookieVal;
  }
  if (staffLocale && isSupportedLocale(staffLocale)) {
    return staffLocale;
  }
  return DEFAULT_LOCALE;
}

/**
 * Fallback helper ensuring that if any field in a locale dictionary is missing or empty,
 * it safely falls back to English without throwing or returning undefined.
 */
function mergeWithFallback<T extends Record<string, unknown>>(target: T, fallback: T): T {
  const result: Record<string, unknown> = { ...fallback };
  for (const [key, value] of Object.entries(target)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeWithFallback(
        value as Record<string, unknown>,
        (fallback[key] || {}) as Record<string, unknown>,
      );
    } else if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Returns the translation dictionary for the given locale with complete English fallback.
 */
export function getDictionary(locale: Locale): TranslationDictionary {
  if (locale === 'en') {
    return enMessages;
  }
  return mergeWithFallback(
    taMessages as unknown as Record<string, unknown>,
    enMessages as unknown as Record<string, unknown>,
  ) as unknown as TranslationDictionary;
}

function lookup(dict: unknown, parts: string[]): string | undefined {
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Type-safe path accessor for translation keys.
 * e.g. t('nav.verification') or t('common.save')
 */
export function getTranslator(locale: Locale) {
  const dict = getDictionary(locale);

  const t = function t(path: string, params?: Record<string, string | number>): string {
    const parts = path.split('.');
    const resolved = lookup(dict, parts) ?? lookup(enMessages, parts) ?? path;

    if (!params) {
      return resolved;
    }

    let formatted = resolved;
    for (const [key, val] of Object.entries(params)) {
      formatted = formatted.replace(new RegExp(`{${key}}`, 'g'), String(val));
    }
    return formatted;
  };

  t.locale = locale;
  t.dict = dict;
  t.t = t;
  return t;
}

/**
 * Server helper to read the active locale from incoming request cookies and/or staff profile.
 */
export async function getAdminLocale(staffLocale?: string | null): Promise<Locale> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    return resolveLocale(cookieVal, staffLocale);
  } catch {
    return resolveLocale(null, staffLocale);
  }
}

/**
 * Single-language message resolver for operational error codes.
 */
export function getLocalizedMessage(code: string, locale: Locale): string {
  const bilingual = bilingualMessageFor(code);
  return locale === 'ta' ? bilingual.ta : bilingual.en;
}

/**
 * Single-language message resolver for validation problems.
 */
export function getLocalizedProblem(problem: string, locale: Locale): string {
  const bilingual = bilingualProblemText(problem);
  return locale === 'ta' ? bilingual.ta : bilingual.en;
}

/**
 * Single-language message resolver for success confirmations.
 */
export function getLocalizedConfirmation(done: string, locale: Locale): string {
  const bilingual = bilingualConfirmation(done);
  return locale === 'ta' ? bilingual.ta : bilingual.en;
}
