'use client';

import { useState, useTransition } from 'react';

import { setLanguageAction } from '@/lib/i18n/actions';
import { useTranslation } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';

type Props = {
  /** Optional variant for different placements: 'compact' (sidebar/header) or 'card' (settings page) */
  variant?: 'compact' | 'card';
  className?: string;
};

export function LanguageSelector({ variant = 'compact', className = '' }: Props) {
  const { locale, setLocale } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setError(null);
    startTransition(async () => {
      const res = await setLocale(nextLocale);
      if (res && !res.success) {
        setError(res.error || 'persistence_failed');
      }
    });
  };

  if (variant === 'card') {
    return (
      <div className={`flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6 ${className}`}>
        <div>
          <h2 className="text-base font-semibold text-text">
            {locale === 'ta' ? 'மொழி விருப்பத்தேர்வு' : 'Language preference'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {locale === 'ta'
              ? 'நிர்வாகப் பக்கங்களில் நீங்கள் பயன்படுத்த விரும்பும் மொழியைத் தேர்ந்தெடுக்கவும்.'
              : 'Choose your preferred language for the administration portal.'}
          </p>
        </div>

        <form action={setLanguageAction} className="mt-2 flex flex-wrap gap-3">
          <button
            type="submit"
            name="locale"
            value="ta"
            aria-pressed={locale === 'ta'}
            onClick={(e) => {
              e.preventDefault();
              handleSelect('ta');
            }}
            disabled={isPending}
            className={`flex min-h-11 min-w-[140px] items-center justify-between rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              locale === 'ta'
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-page text-text hover:bg-surface'
            }`}>
            <span lang="ta">தமிழ்</span>
            {locale === 'ta' && <span aria-hidden="true">✓</span>}
          </button>

          <button
            type="submit"
            name="locale"
            value="en"
            aria-pressed={locale === 'en'}
            onClick={(e) => {
              e.preventDefault();
              handleSelect('en');
            }}
            disabled={isPending}
            className={`flex min-h-11 min-w-[140px] items-center justify-between rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              locale === 'en'
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-page text-text hover:bg-surface'
            }`}>
            <span lang="en">English</span>
            {locale === 'en' && <span aria-hidden="true">✓</span>}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-error">
            ! {locale === 'ta'
              ? 'மொழி விருப்பத்தேர்வை சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
              : 'Failed to save language preference. Please try again.'}
          </p>
        )}
      </div>
    );
  }

  // Compact variant for global navigation / header / pre-auth cards
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <form
        action={setLanguageAction}
        aria-label={locale === 'ta' ? 'மொழியை மாற்றுக' : 'Switch language'}
        className="inline-flex items-center rounded-lg border border-line bg-card p-0.5 text-xs font-medium">
      <button
        type="submit"
        name="locale"
        value="ta"
        aria-label="தமிழ் மொழியைத் தெரிவுசெய்க"
        aria-pressed={locale === 'ta'}
        onClick={(e) => {
          e.preventDefault();
          handleSelect('ta');
        }}
        disabled={isPending}
        className={`flex min-h-[36px] min-w-[44px] items-center justify-center rounded-md px-2.5 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
          locale === 'ta'
            ? 'bg-primary font-semibold text-on-primary shadow-xs'
            : 'text-muted hover:text-text'
        }`}>
        <span lang="ta">தமிழ்</span>
      </button>

      <span className="text-line select-none" aria-hidden="true">
        |
      </span>

      <button
        type="submit"
        name="locale"
        value="en"
        aria-label="Select English language"
        aria-pressed={locale === 'en'}
        onClick={(e) => {
          e.preventDefault();
          handleSelect('en');
        }}
        disabled={isPending}
        className={`flex min-h-[36px] min-w-[44px] items-center justify-center rounded-md px-2.5 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
          locale === 'en'
            ? 'bg-primary font-semibold text-on-primary shadow-xs'
            : 'text-muted hover:text-text'
        }`}>
        <span lang="en">English</span>
      </button>
    </form>
    {error && (
      <p role="alert" className="text-xs font-medium text-error">
        ! {locale === 'ta' ? 'சேமிக்க முடியவில்லை' : 'Failed to save'}
      </p>
    )}
  </div>
  );
}
