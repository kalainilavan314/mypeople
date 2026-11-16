'use client';

import { useState } from 'react';

import { SubmitButton } from '@/components/SubmitButton';

import { signIn } from './actions';

const input = 'min-h-12 w-full rounded-lg border border-line bg-card px-3 text-base text-text outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20';

export function SignInForm() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [route, setRoute] = useState<'nic' | 'passport'>('nic');
  const passwordToggleLabel = passwordVisible ? 'Hide password' : 'Show password';

  return (
    <form action={signIn} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-text">ID used to register</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ID used to register">
          <label className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${route === 'nic' ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:bg-surface'}`}>
            <input type="radio" name="route" value="nic" checked={route === 'nic'} onChange={() => setRoute('nic')} className="h-4 w-4 accent-primary" />
            National ID
          </label>
          <label className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${route === 'passport' ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:bg-surface'}`}>
            <input type="radio" name="route" value="passport" checked={route === 'passport'} onChange={() => setRoute('passport')} className="h-4 w-4 accent-primary" />
            Passport
          </label>
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-medium text-text">
        NIC or passport number
        <input name="number" required autoComplete="username" className={input} />
      </label>

      {route === 'passport' ? (
        <label className="flex flex-col gap-2 text-sm font-medium text-text">
          Passport country
          <input name="country" maxLength={3} autoCapitalize="characters" className={input} placeholder="Three-letter country code" />
        </label>
      ) : null}

      <label className="flex flex-col gap-2 text-sm font-medium text-text">
        Password
        <span className="relative">
          <input
            name="password"
            type={passwordVisible ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className={`${input} pr-12`}
          />
          <button
            type="button"
            aria-label={passwordToggleLabel}
            aria-pressed={passwordVisible}
            title={passwordToggleLabel}
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
            {passwordVisible ? (
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.6 10.6 0 0112 4c5.2 0 8.7 4.1 9.7 6.1a1.8 1.8 0 010 1.8 12.7 12.7 0 01-3 3.7M6.6 6.6A12.7 12.7 0 002.3 10.1a1.8 1.8 0 000 1.8C3.3 13.9 6.8 18 12 18c1.2 0 2.3-.2 3.4-.7" />
              </svg>
            ) : (
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.3 12S5.8 6 12 6s9.7 6 9.7 6-3.5 6-9.7 6S2.3 12 2.3 12z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </span>
      </label>

      <SubmitButton>
        Sign in
      </SubmitButton>
    </form>
  );
}
