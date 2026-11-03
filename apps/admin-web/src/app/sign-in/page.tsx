import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { LanguageSelector } from '@/components/LanguageSelector';
import { PageHeader } from '@/components/PageHeader';
import { getAdminLocale } from '@/lib/i18n';

import { SignInForm } from './SignInForm';

export default function SignInPage(props: PageProps<'/sign-in'>) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <PageHeader ta="பணியாளர் உள்நுழைவு" en="Staff sign-in" />
        <LanguageSelector />
      </div>

      <Suspense fallback={null}>
        <SignInMessages searchParams={props.searchParams} />
      </Suspense>

      <SignInForm />
    </main>
  );
}

async function SignInMessages({ searchParams }: { searchParams: PageProps<'/sign-in'>['searchParams'] }) {
  const locale = await getAdminLocale();
  const params = await searchParams;

  if (params.ended) {
    return (
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
        <p lang={locale} className="font-semibold">
          {locale === 'ta' ? '… உங்கள் அமர்வு முடிவடைந்தது. மீண்டும் உள்நுழையவும்.' : '… Your session ended. Sign in again.'}
        </p>
      </div>
    );
  }
  return <Feedback error={params.error} />;
}
