import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { SystemStatus } from '@/components/SystemStatus';
import { builtModules, plannedModules } from '@/lib/modules';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

export default function DashboardHome() {
  return (
    <>
      <PageHeader ta="நிர்வாகம்" en="Administration" brd="§15A.6" />
      <p className="rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
        ! Not deployed yet. The API this dashboard uses (/v1) is not live, and evidence watermarking (FR-WEB-006) and a
        strict content-security policy come before release.
      </p>
      <Suspense fallback={<p className="text-muted">… Loading your work</p>}>
        <MyWork />
      </Suspense>
      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="text-base font-bold">
          System status
        </h2>
        <Suspense fallback={<p className="text-muted">… Checking</p>}>
          <SystemStatus />
        </Suspense>
      </section>
      <section aria-labelledby="planned-heading" className="flex flex-col gap-3">
        <h2 id="planned-heading" className="text-base font-bold">
          Not built yet
        </h2>
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
    </>
  );
}

/** The person's modules, with the review queue counts when they review identities. */
async function MyWork() {
  const staff = await requireStaff();
  const counts = staff.permissions.has('members.verify') ? await (await staffApi()).getIdentityReviewCounts() : null;
  const allowed = builtModules.filter((module) => staff.permissions.has(module.permission));
  return (
    <section aria-labelledby="work-heading" className="flex flex-col gap-3">
      <h2 id="work-heading" className="text-base font-bold">
        Your work
      </h2>
      {allowed.length === 0 ? <p className="text-sm text-muted">Your role has no dashboard modules.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {allowed.map((module) => (
          <li key={module.href}>
            <Link href={module.href} className="flex min-h-20 flex-col gap-1 rounded-xl border border-line bg-card p-4 hover:bg-surface">
              <span lang="ta" className="text-xs text-muted">
                {module.ta}
              </span>
              <span className="font-semibold">{module.en}</span>
              {module.href === '/verification' && counts ? (
                <span className="text-sm text-muted">
                  {counts.awaitingReview} waiting · {counts.needsUpdate} with the member · {counts.assignedToMe} claimed by you
                </span>
              ) : (
                <span className="text-xs text-muted">BRD {module.brd}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
