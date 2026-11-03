import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';

import { signIn } from './actions';

const input = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base';

export default function SignInPage(props: PageProps<'/sign-in'>) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <PageHeader ta="பணியாளர் உள்நுழைவு" en="Staff sign-in" />
      <div className="flex flex-col gap-0.5 text-sm text-muted">
        <p lang="ta">
          உங்கள் சொந்த உறுப்பினர் கணக்கு மூலம் உள்நுழையவும். அடுத்து அங்கீகாரக் குறியீடு கோரப்படும்; உங்கள் பொறுப்பிற்குரியவை மட்டுமே திறக்கப்படும்.
        </p>
        <p lang="en" className="text-xs">
          Sign in with your own member account. An authenticator code follows; your role decides what you can open.
        </p>
      </div>
      <Suspense fallback={null}>
        <SignInMessages searchParams={props.searchParams} />
      </Suspense>
      <form action={signIn} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1">
            <span lang="ta" className="block text-xs font-semibold text-muted">பதிவுசெய்த அடையாள ஆவணம்</span>
            <span lang="en" className="block text-sm font-semibold">ID used to register</span>
          </legend>
          <div className="flex gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="radio" name="route" value="nic" defaultChecked /> NIC (தேசிய அடையாள அட்டை)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="radio" name="route" value="passport" /> Passport (கடவுச்சீட்டு)
            </label>
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">தேசிய அடையாள அட்டை அல்லது கடவுச்சீட்டு இலக்கம் *</span>
          <span lang="en" className="text-xs">NIC or passport number *</span>
          <input name="number" required autoComplete="username" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">கடவுச்சீட்டு நாடு (மூன்று எழுத்துகள், கடவுச்சீட்டிற்கு மட்டும்)</span>
          <span lang="en" className="text-xs">Passport country (three letters, passport only)</span>
          <input name="country" maxLength={3} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">கடவுச்சொல் *</span>
          <span lang="en" className="text-xs">Password *</span>
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        <SubmitButton>
          <span className="flex flex-col items-center">
            <span lang="ta">உள்நுழைக</span>
            <span lang="en" className="text-xs font-normal opacity-90">Sign in</span>
          </span>
        </SubmitButton>
      </form>
    </main>
  );
}

async function SignInMessages({ searchParams }: { searchParams: PageProps<'/sign-in'>['searchParams'] }) {
  const params = await searchParams;
  if (params.ended) {
    return (
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
        <p lang="ta" className="font-semibold">… உங்கள் அமர்வு முடிவடைந்தது. மீண்டும் உள்நுழையவும்.</p>
        <p lang="en" className="text-xs">… Your session ended. Sign in again.</p>
      </div>
    );
  }
  return <Feedback error={params.error} />;
}
