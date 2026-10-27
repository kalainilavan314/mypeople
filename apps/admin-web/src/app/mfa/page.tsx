import { ApiError } from '@my-people/api-client';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { readStaffToken, staffApi } from '@/lib/session';

import { giveCode } from './actions';
import { Enrolment } from './Enrolment';

export default function MfaPage(props: PageProps<'/mfa'>) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <PageHeader ta="இரண்டாவது காரணி" en="Authenticator code" brd="FR-STF-001, NFR-SEC-04" />
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
  const params = await searchParams;
  const enrolling = !status.enabled;

  return (
    <>
      <p className="text-sm text-muted">
        {enrolling
          ? 'Staff give an authenticator code in every session. Set one up: scan the code with an authenticator app or type the key, then enter the six-digit code it shows.'
          : 'Open your authenticator app and enter the six-digit code for My People.'}
      </p>
      <Feedback error={params.error} />
      {enrolling ? <Enrolment /> : null}
      <form action={giveCode} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <input type="hidden" name="enrolling" value={enrolling ? '1' : '0'} />
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Six-digit code
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
        <SubmitButton>Confirm</SubmitButton>
      </form>
    </>
  );
}
