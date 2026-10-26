import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fallbackLanguage, resources } from '@my-people/i18n';

import { en } from '@/i18n/en';
import { ta } from '@/i18n/ta';

import { readLanguage, saveLanguage } from './storage';

// The PWA's shared text, plus this app's own screens under "m"
// (t('m.signIn.title')). It starts in English, as the PWA does, until the
// member picks a language on the welcome screen or in Profile.
void i18n.use(initReactI18next).init({
  resources: {
    ta: { translation: { ...resources.ta.translation, m: ta } },
    en: { translation: { ...resources.en.translation, m: en } },
  },
  lng: fallbackLanguage,
  fallbackLng: fallbackLanguage,
  interpolation: { escapeValue: false }, // React already escapes text
});

export type AppLanguage = 'ta' | 'en';

/** Applies the language saved on this device, if any. */
export async function restoreLanguage(): Promise<void> {
  const saved = await readLanguage();
  if (saved === 'ta' || saved === 'en') await i18n.changeLanguage(saved);
}

export async function chooseLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await saveLanguage(language);
}

export default i18n;
