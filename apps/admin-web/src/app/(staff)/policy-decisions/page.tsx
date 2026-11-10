import type { PolicyDecision } from '@my-people/api-client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function statusOf(item: PolicyDecision): string {
  return item.current?.status ?? 'not_started';
}

export default function PolicyDecisionsPage(props: PageProps<'/policy-decisions'>) {
  return (
    <>
      <PageHeader ta="Policy decisions" en="Policy decisions" locale="en" />
      <Suspense fallback={<ConsoleLoading />}>
        <DecisionRegister searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function DecisionRegister({ searchParams }: { searchParams: PageProps<'/policy-decisions'>['searchParams'] }) {
  const staff = await requireStaff();
  if (!staff.permissions.has('system.configure')) notFound();
  const params = await searchParams;
  const selectedStatus = one(params.status) ?? 'all';
  const selectedWorkstream = one(params.workstream) ?? 'all';
  const decisions = await (await staffApi()).listPolicyDecisions();
  const approved = decisions.filter((item) => statusOf(item) === 'approved').length;
  const underReview = decisions.filter((item) => statusOf(item) === 'in_review').length;
  const blocked = decisions.length - approved;
  const workstreams = [...new Set(decisions.map((item) => item.workstream))].sort();
  const visible = decisions.filter(
    (item) =>
      (selectedStatus === 'all' || statusOf(item) === selectedStatus) &&
      (selectedWorkstream === 'all' || item.workstream === selectedWorkstream),
  );

  return (
    <div className="flex flex-col gap-6" data-ui>
      <section aria-labelledby="release-question" className="rounded-lg bg-card p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end">
          <div>
            <h2 id="release-question" className="text-lg font-semibold text-text">
              Which policy decisions still block Phase 1 production?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Proposed defaults are not approvals. A decision clears only after every named owner has signed and its controlled evidence reference is recorded.
            </p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface px-2 py-4">
            <div className="px-3">
              <dt className="text-xs text-muted">Blocked</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{blocked}</dd>
            </div>
            <div className="px-3">
              <dt className="text-xs text-muted">In review</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{underReview}</dd>
            </div>
            <div className="px-3">
              <dt className="text-xs text-muted">Approved</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{approved}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="register-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="register-heading" className="text-base font-semibold text-text">Decision register</h2>
            <p className="mt-1 text-sm text-muted">{visible.length} of {decisions.length} decisions shown</p>
          </div>
          <form action="/policy-decisions" className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row" role="search">
            <label className="flex flex-col gap-1 text-sm font-medium text-text">
              Status
              <select name="status" defaultValue={selectedStatus} className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm">
                <option value="all">All statuses</option>
                <option value="not_started">Not started</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-text">
              Workstream
              <select name="workstream" defaultValue={selectedWorkstream} className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm">
                <option value="all">All workstreams</option>
                {workstreams.map((workstream) => <option key={workstream}>{workstream}</option>)}
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary sm:self-end">Apply filters</button>
          </form>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Phase 1 policy decision register</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="w-[42%] px-3 py-3 font-medium" scope="col">Decision</th>
                <th className="px-3 py-3 font-medium" scope="col">Workstream</th>
                <th className="px-3 py-3 font-medium" scope="col">Status</th>
                <th className="px-3 py-3 font-medium" scope="col">Approvals</th>
                <th className="px-3 py-3 text-right font-medium" scope="col">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-y border-line">
              {visible.map((item) => (
                <tr key={item.key} className="hover:bg-surface">
                  <td className="px-3 py-4">
                    <p className="font-semibold text-text">{item.title}</p>
                    <p className="mt-1 font-mono text-xs text-muted">{item.key}</p>
                  </td>
                  <td className="px-3 py-4 text-muted">{item.workstream}</td>
                  <td className="px-3 py-4"><StateTag state={statusOf(item)} locale="en" /></td>
                  <td className="px-3 py-4 tabular-nums text-text">{item.approvedRoles.length} / {item.requiredRoles.length}</td>
                  <td className="px-3 py-4 text-right">
                    <Link href={`/policy-decisions/${item.key}`} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      Open decision
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-line border-y border-line md:hidden">
          {visible.map((item) => (
            <li key={item.key} className="py-4">
              <Link href={`/policy-decisions/${item.key}`} className="block rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-text">{item.title}</p><p className="mt-1 font-mono text-xs text-muted">{item.key}</p></div>
                  <StateTag state={statusOf(item)} locale="en" />
                </div>
                <p className="mt-3 text-sm text-muted">{item.workstream} · {item.approvedRoles.length} of {item.requiredRoles.length} approvals</p>
              </Link>
            </li>
          ))}
        </ul>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            No decisions match these filters.
          </div>
        ) : null}
      </section>
    </div>
  );
}
