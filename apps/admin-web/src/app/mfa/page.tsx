import { ApiError } from '@my-people/api-client';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { LanguageSelector } from '@/components/LanguageSelector';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { getAdminLocale } from '@/lib/i18n';
import { readStaffToken, staffApi } from '@/lib/session';

import { giveCode } from './actions';
import { Enrolment } from './Enrolment';

export default function MfaPage(props: PageProps<'/mfa'>) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <PageHeader ta="இரண்டாவது காரணி" en="Authenticator code" />
        <LanguageSelector />
      </div>
      <Suspense fallback={<p className="text-muted">… Checking</p>}>
        <MfaStep searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function MfaStep({ searchParams }: { searchParams: PageProps<'/mfa'>['searchParams'] }) {
  if (!(await readStaffToken())) redirect('/sign-in');
  let status;
  try {
    status = await (await staffApi()).getMfaStatus();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/sign-in?ended=1');
    throw error;
  }
  if (status.sessionVerified) redirect('/');
  const locale = await getAdminLocale();
  const params = await searchParams;
  const enrolling = !status.enabled;

  return (
    <>
      <div className="flex flex-col gap-0.5 text-sm text-muted">
        <p lang={locale}>
          {enrolling
            ? locale === 'ta'
              ? 'பணியாளர்கள் ஒவ்வொரு அமர்விலும் அங்கீகாரக் குறியீட்டை உள்ளிட வேண்டும். செயலியைப் பயன்படுத்தி குறியீட்டை ஸ்கேன் செய்யவும் அல்லது விசையை உள்ளிட்டு, தோன்றும் ஆறு இலக்கக் குறியீட்டைப் பதிவுசெய்யவும்.'
              : 'Staff give an authenticator code in every session. Set one up: scan the code with an authenticator app or type the key, then enter the six-digit code it shows.'
            : locale === 'ta'
              ? 'உங்கள் அங்கீகாரச் செயலியைத் திறந்து "என் மக்கள்" (My People) கணக்கிற்கான 6 இலக்கக் குறியீட்டை உள்ளிடவும்.'
              : 'Open your authenticator app and enter the six-digit code for My People.'}
        </p>
      </div>

      <Feedback error={params.error} />
      {enrolling ? <Enrolment /> : null}

      <form action={giveCode} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <input type="hidden" name="enrolling" value={enrolling ? '1' : '0'} />
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'ஆறு இலக்கக் குறியீடு *' : 'Six-digit code *'}</span>
          <input
            name="code"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            className="min-h-11 rounded-lg border border-line px-3 font-mono text-base"
          />
        </label>
        <SubmitButton>
          <span lang={locale}>{locale === 'ta' ? 'உறுதிப்படுத்துக' : 'Confirm'}</span>
        </SubmitButton>
      </form>
    </>
  );
}
