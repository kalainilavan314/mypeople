import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';

import { signIn } from './actions';

const input = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base';

export default function SignInPage(props: PageProps<'/sign-in'>) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <PageHeader ta="பணியாளர் உள்நுழைவு" en="Staff sign-in" brd="S01, NFR-SEC-04" />
      <p className="text-sm text-muted">
        Sign in with your own member account. An authenticator code follows; your role decides what you can open.
      </p>
      <Suspense fallback={null}>
        <SignInMessages searchParams={props.searchParams} />
      </Suspense>
      <form action={signIn} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
        <fieldset className="flex gap-4">
          <legend className="mb-2 text-sm font-semibold">ID used to register</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="route" value="nic" defaultChecked /> NIC
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="route" value="passport" /> Passport
          </label>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          NIC or passport number
          <input name="number" required autoComplete="username" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Passport country (three letters, passport only)
          <input name="country" maxLength={3} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Password
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        <SubmitButton>Sign in</SubmitButton>
      </form>
    </main>
  );
}

async function SignInMessages({ searchParams }: { searchParams: PageProps<'/sign-in'>['searchParams'] }) {
  const params = await searchParams;
  if (params.ended) {
    return <p className="rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">… Your session ended. Sign in again.</p>;
  }
  return <Feedback error={params.error} />;
}
