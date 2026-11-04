import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';

import { SignInForm } from './SignInForm';

export default function SignInPage(props: PageProps<'/sign-in'>) {
  return (
    <main className="min-h-screen bg-page px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-16 lg:px-12 lg:py-12 xl:px-20">
      <section className="flex max-w-xl flex-col justify-between border-b border-line pb-10 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-16">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-semibold text-primary">My People</p>
          <div className="flex flex-col gap-3">
            <PageHeader ta="பணியாளர் உள்நுழைவு" en="Staff administration" />
            <p className="max-w-md text-base leading-7 text-muted">
              Secure access for authorised staff. Your assigned role determines which operational records and decisions you can open.
            </p>
          </div>
        </div>
        <p className="mt-10 max-w-sm text-sm leading-6 text-muted lg:mt-0">
          Authentication requires your member account and a second factor. Every sensitive staff action is recorded.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center pt-10 lg:pt-0" aria-label="Staff sign-in">
        <div className="flex flex-col gap-6 rounded-lg border border-line bg-card p-5 sm:p-7">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-text">Sign in</h2>
            <p className="text-sm leading-6 text-muted">Use the identity document and password registered to your own account.</p>
          </div>

          <Suspense fallback={null}>
            <SignInMessages searchParams={props.searchParams} />
          </Suspense>

          <SignInForm />
        </div>
      </section>
    </main>
  );
}

async function SignInMessages({ searchParams }: { searchParams: PageProps<'/sign-in'>['searchParams'] }) {
  const params = await searchParams;

  if (params.ended) {
    return (
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
        <p className="font-semibold">Your session ended. Sign in again.</p>
      </div>
    );
  }
  return <Feedback error={params.error} />;
}
