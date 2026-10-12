import type { Lang } from '@/core/api/types';
import en from '@/core/i18n/en.json';
import si from '@/core/i18n/si.json';
import ta from '@/core/i18n/ta.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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

export function pick(lang: string, ta_: string, en_: string): string {
  if (lang === 'en') return en_ || ta_;
  return ta_ || en_;
}
