import { Suspense } from 'react';

import { SystemStatus } from '@/components/SystemStatus';
import { plannedModules } from '@/lib/modules';

export default function DashboardHome() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">என் மக்கள் · My People</p>
        <h1 className="text-2xl font-bold">Administration</h1>
      </header>

      <p className="rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
        ! Not for deployment yet. Staff sign-in with MFA and server-side permission checks come first (BRD §15A.6).
      </p>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="text-base font-bold">
          System status
        </h2>
        <Suspense fallback={<p className="text-muted">… Checking</p>}>
          <SystemStatus />
        </Suspense>
      </section>

      <section aria-labelledby="modules-heading" className="flex flex-col gap-3">
        <h2 id="modules-heading" className="text-base font-bold">
          Modules
        </h2>
        <p className="text-sm text-muted">None of these is built yet. Each will open behind staff sign-in.</p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {plannedModules.map((module) => (
            <li key={module.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-semibold">{module.name}</span>
                <span className="block text-xs text-muted">BRD {module.brd}</span>
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">Not built yet</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
