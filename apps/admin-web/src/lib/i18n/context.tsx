'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { switchLanguage } from './actions';
import { enMessages } from './en';
import { taMessages } from './ta';
import {
  DEFAULT_LOCALE,
  type Locale,
  type TranslationDictionary,
} from './types';

type LanguageContextValue = {
  locale: Locale;
  t: (path: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => Promise<{ success: boolean; error?: string }>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getDict(locale: Locale): TranslationDictionary {
  return locale === 'en' ? enMessages : taMessages;
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

export function LanguageProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const [prevInitialLocale, setPrevInitialLocale] = useState(initialLocale);
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep state synchronized if initialLocale changes across server navigations without effect cascading renders
  if (prevInitialLocale !== initialLocale) {
    setPrevInitialLocale(initialLocale);
    setLocaleState(initialLocale);
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      if (locale === 'ta') {
        document.documentElement.classList.add('ta');
      } else {
        document.documentElement.classList.remove('ta');
      }
    }
  }, [locale]);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const dict = getDict(locale);
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
    },
    [locale],
  );

  const setLocale = useCallback(
    async (nextLocale: Locale): Promise<{ success: boolean; error?: string }> => {
      const prevLocale = locale;
      setLocaleState(nextLocale);
      const res = await switchLanguage(nextLocale);
      if (!res.success) {
        setLocaleState(prevLocale);
        return { success: false, error: res.error || 'persistence_failed' };
      }
      return { success: true };
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
    }),
    [locale, t, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside provider (e.g. tests)
    const defaultDict = taMessages;
    return {
      locale: DEFAULT_LOCALE,
      t: (path: string, params?: Record<string, string | number>) => {
        const parts = path.split('.');
        const resolved = lookup(defaultDict, parts) ?? path;
        if (!params) return resolved;
        let formatted = resolved;
        for (const [k, v] of Object.entries(params)) {
          formatted = formatted.replace(new RegExp(`{${k}}`, 'g'), String(v));
        }
        return formatted;
      },
      setLocale: async () => {},
    };
  }
  return ctx;
}

export function useLocale(): Locale {
  const { locale } = useTranslation();
  return locale;
}
