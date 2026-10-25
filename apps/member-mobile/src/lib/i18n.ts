import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fallbackLanguage, resources } from '@my-people/i18n';

// The same Tamil and English text as the PWA. It starts in English, as the PWA
// does; a language choice arrives with the Profile feature.
void i18n.use(initReactI18next).init({
  resources,
  lng: fallbackLanguage,
  fallbackLng: fallbackLanguage,
  interpolation: { escapeValue: false }, // React already escapes text
});

export default i18n;
