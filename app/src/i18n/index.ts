import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ta from './ta.json';
import en from './en.json';
import si from './si.json';
import type { Lang } from '../data/types';

export const SUPPORTED_LANGS: Lang[] = ['ta', 'en', 'si'];

void i18n.use(initReactI18next).init({
  resources: {
    ta: { translation: ta },
    en: { translation: en },
    si: { translation: si },
  },
  lng: 'en',
  fallbackLng: 'en', // Start in English; users can switch to Tamil in Profile
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;

const LANG_KEY = 'npm.lang';

/**
 * The language the user explicitly chose (welcome/login toggle or the Language
 * screen), or null if they never picked one. An explicit choice outranks the
 * member record's stored preference — otherwise logging in would snap the UI
 * back to the account's language and undo the switch they just made.
 */
export function savedLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v && (SUPPORTED_LANGS as string[]).includes(v) ? (v as Lang) : null;
  } catch {
    return null;
  }
}

export function setSavedLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode — in-memory only */
  }
  void i18n.changeLanguage(lang);
}

/**
 * Pick a bilingual value from data (`*Ta` / `*En`) by the active UI language.
 * Falls back to Tamil, per PROJECT.md.
 */
export function pick(lang: string, ta_: string, en_: string): string {
  if (lang === 'en') return en_ || ta_;
  return ta_ || en_;
}
