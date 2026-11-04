'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { Locale } from './types';

const LanguageContext = createContext<Locale>('en');

export function LanguageProvider({ children }: {
  children: ReactNode;
}) {
  return <LanguageContext.Provider value="en">{children}</LanguageContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LanguageContext);
}
