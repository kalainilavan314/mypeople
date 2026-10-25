import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fallbackLanguage, resources } from '@my-people/i18n';

// Staff-only labels, kept here until the staff features move their text into
// packages/i18n. The Tamil is new and must be reviewed by a Tamil speaker
// before release.
const staffText = {
  en: { tabs: { tasks: 'Tasks', cases: 'Cases', checkIn: 'Check-in' } },
  ta: { tabs: { tasks: 'பணிகள்', cases: 'விவகாரங்கள்', checkIn: 'வருகைப் பதிவு' } },
};

void i18n.use(initReactI18next).init({
  resources: {
    ...resources,
    en: { ...resources.en, staff: staffText.en },
    ta: { ...resources.ta, staff: staffText.ta },
  },
  lng: fallbackLanguage,
  fallbackLng: fallbackLanguage,
  interpolation: { escapeValue: false }, // React already escapes text
});

export default i18n;
