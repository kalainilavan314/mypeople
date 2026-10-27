import { useTranslation } from 'react-i18next';

/** The languages the apps offer members and staff; Sinhala waits for FP-02. */
export type AppLanguage = 'ta' | 'en';


/** The member's language as the app uses it: Tamil or English. */
export function useLanguage(): AppLanguage {
  const { i18n } = useTranslation();
  return i18n.language === 'ta' ? 'ta' : 'en';
}

/** Picks the Tamil or English field of bilingual API data. */
export function useLocalized() {
  const language = useLanguage();
  return (english: string, tamil: string) => (language === 'ta' && tamil ? tamil : english);
}
