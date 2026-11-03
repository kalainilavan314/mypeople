'use client';

import { SubmitButton } from '@/components/SubmitButton';
import { useLocale } from '@/lib/i18n/context';

import { signIn } from './actions';

const input = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base';

export function SignInForm() {
  const locale = useLocale();

  return (
    <>
      <p lang={locale} className="text-sm text-muted">
        {locale === 'ta'
          ? 'உங்கள் சொந்த உறுப்பினர் கணக்கு மூலம் உள்நுழையவும். அடுத்து அங்கீகாரக் குறியீடு கோரப்படும்; உங்கள் பொறுப்பிற்குரியவை மட்டுமே திறக்கப்படும்.'
          : 'Sign in with your own member account. An authenticator code follows; your role decides what you can open.'}
      </p>

      <form action={signIn} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-text">
            <span lang={locale}>{locale === 'ta' ? 'பதிவுசெய்த அடையாள ஆவணம்' : 'ID used to register'}</span>
          </legend>
          <div className="flex gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="radio" name="route" value="nic" defaultChecked />
              <span lang={locale}>{locale === 'ta' ? 'தேசிய அடையாள அட்டை (NIC)' : 'National ID (NIC)'}</span>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="radio" name="route" value="passport" />
              <span lang={locale}>{locale === 'ta' ? 'கடவுச்சீட்டு (Passport)' : 'Passport'}</span>
            </label>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>
            {locale === 'ta' ? 'தேசிய அடையாள அட்டை அல்லது கடவுச்சீட்டு இலக்கம் *' : 'NIC or passport number *'}
          </span>
          <input name="number" required autoComplete="username" className={input} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>
            {locale === 'ta'
              ? 'கடவுச்சீட்டு நாடு (மூன்று எழுத்துகள், கடவுச்சீட்டிற்கு மட்டும்)'
              : 'Passport country (three letters, passport only)'}
          </span>
          <input name="country" maxLength={3} className={input} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'கடவுச்சொல் *' : 'Password *'}</span>
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>

        <SubmitButton>
          <span lang={locale}>{locale === 'ta' ? 'உள்நுழைக' : 'Sign in'}</span>
        </SubmitButton>
      </form>
    </>
  );
}
