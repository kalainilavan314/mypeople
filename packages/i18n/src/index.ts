// Tamil, English and Sinhala UI text for the new apps, in i18next format.
//
// The JSON files are copies of the live PWA's (app/src/core/i18n). Until the
// PWA is retired, change both; test/resources.test.ts fails if they differ.
// Sinhala is partial and not yet offered to members (BRD FP-02).
import en from './en.json';
import si from './si.json';
import ta from './ta.json';

export const languages = ['ta', 'en', 'si'] as const;
export type Language = (typeof languages)[number];

/** Used for any text missing in the member's language. */
export const fallbackLanguage: Language = 'en';

/** Pass straight to i18next.init({ resources }). */
export const resources = {
  ta: { translation: ta },
  en: { translation: en },
  si: { translation: si },
} as const;
