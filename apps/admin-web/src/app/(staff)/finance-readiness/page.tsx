import type { FinanceProductionControl, PolicyDecision } from '@my-people/api-client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { recordFinanceProductionControl } from '@/features/finance/readinessActions';
import { formatDateTime } from '@/lib/format';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

type ControlDefinition = {
  key: FinanceProductionControl['controlKey'];
  decisionKey: string;
  label: string;
  description: string;
  input: { kind: 'number'; min: number; max: number; suffix: string } | { kind: 'select'; options: readonly { value: string; label: string }[] };
};

const controls: readonly ControlDefinition[] = [
  {
    key: 'enhanced_review_threshold_minor',
    decisionKey: 'FIN-01',
    label: 'Enhanced-review threshold',
    description: 'The approved LKR amount, stored in cents, that adds an enhanced-review warning.',
    input: { kind: 'number', min: 1, max: 1_000_000_000_000, suffix: 'minor units' },
  },
  {
    key: 'statutory_reporting_mode',
    decisionKey: 'FIN-02',
    label: 'Statutory reporting treatment',
    description: 'Whether counsel found no applicable Party duty or requires manual compliance review.',
    input: {
      kind: 'select',
      options: [
        { value: 'not_applicable', label: 'No applicable Party reporting duty recorded' },
        { value: 'manual_review_required', label: 'Manual compliance review required' },
      ],
    },
  },
  {
    key: 'slip_retention_days',
    decisionKey: 'FIN-03',
    label: 'Slip-evidence retention period',
    description: 'The approved evidence period. P3 records it but does not enable automatic deletion.',
    input: { kind: 'number', min: 1, max: 3_650, suffix: 'days' },
  },
  {
    key: 'third_party_payment_mode',
    decisionKey: 'FIN-05',
    label: 'Third-party payment treatment',
    description: 'Block third-party submissions or route them to explicit manual finance review.',
    input: {
      kind: 'select',
      options: [
        { value: 'blocked', label: 'Blocked' },
        { value: 'manual_review', label: 'Allowed only with manual review warning' },
      ],
    },
  },
  {
    key: 'pilot_currency',
    decisionKey: 'FIN-05',
    label: 'Domestic pilot currency',
    description: 'The bank-transfer pilot accepts LKR only. Foreign currency and cards remain disabled.',
    input: { kind: 'select', options: [{ value: 'LKR', label: 'LKR' }] },
  },
];

const field = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm font-semibold text-text';
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function FinanceReadinessPage(props: PageProps<'/finance-readiness'>) {
  return (
    <>
      <PageHeader ta="Finance production readiness" en="Finance production readiness" locale="en" />
      <Suspense fallback={<ConsoleLoading rows={7} />}>
        <FinanceReadinessConsole searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function FinanceReadinessConsole({ searchParams }: { searchParams: PageProps<'/finance-readiness'>['searchParams'] }) {
  const staff = await requireStaff();
  if (!staff.permissions.has('system.configure')) notFound();

  const api = await staffApi();
  const [readiness, decisions, query] = await Promise.all([
    api.getFinanceProductionReadiness(),
    api.listPolicyDecisions(),
    searchParams,
  ]);
  const currentControls = new Map(readiness.controls.map((item) => [item.controlKey, item]));
  const decisionMap = new Map(decisions.map((item) => [item.key, item]));
  const readyCount = readiness.checks.filter((item) => item.ready).length;

  return (
    <div className="flex flex-col gap-8" data-ui>
      <Feedback error={one(query.error)} problems={[]} done={one(query.done)} />

      <section aria-labelledby="finance-readiness-question" className="rounded-lg bg-card p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] lg:items-end">
          <div>
            <h2 id="finance-readiness-question" className="text-lg font-semibold text-text">
              Can domestic bank-transfer intake open without relying on a proposed rule?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Production opens only when the current approved decisions, machine controls, secure runtime configuration, independent staff and receipt capacity all agree.
            </p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface px-2 py-4">
            <div className="px-3"><dt className="text-xs text-muted">Checks ready</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{readyCount} / {readiness.checks.length}</dd></div>
            <div className="px-3"><dt className="text-xs text-muted">Finance staff</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{readiness.distinctFinanceStaffCount}</dd></div>
            <div className="px-3"><dt className="text-xs text-muted">Receipts left</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{readiness.receiptRemaining.toLocaleString()}</dd></div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="release-state-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="release-state-heading" className="text-base font-semibold text-text">Release state</h2><p className="mt-1 text-sm text-muted">Current server-enforced checks; no secrets or bank account numbers are returned.</p></div>
          <StateTag state={readiness.ready ? 'approved' : 'blocked'} locale="en" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="px-3 py-3 font-medium">Check</th><th className="px-3 py-3 font-medium">Current evidence</th><th className="px-3 py-3 text-right font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-line border-y border-line">
              {readiness.checks.map((check) => (
                <tr key={check.key}>
                  <td className="px-3 py-4 font-semibold text-text">{check.label}</td>
                  <td className="px-3 py-4 text-muted">{check.detail}</td>
                  <td className="px-3 py-4 text-right"><StateTag state={check.ready ? 'approved' : 'blocked'} locale="en" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="finance-controls-heading">
        <div className="mb-4">
          <h2 id="finance-controls-heading" className="text-base font-semibold text-text">Approved production controls</h2>
          <p className="mt-1 text-sm text-muted">Each record is immutable and valid only for the exact current approved decision revision.</p>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {controls.map((definition) => {
            const current = currentControls.get(definition.key);
            const decision = decisionMap.get(definition.decisionKey);
            const approvedRevision = approvedCurrent(decision);
            const isCurrent = Boolean(current && approvedRevision && current.decisionRevisionId === approvedRevision.id);
            return (
              <details key={definition.key} className="group py-4" open={!isCurrent}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span><span className="block font-semibold text-text">{definition.label}</span><span className="mt-1 block text-sm text-muted">{definition.description}</span></span>
                  <span className="shrink-0"><StateTag state={isCurrent ? 'approved' : 'blocked'} locale="en" /></span>
                </summary>
                <div className="mt-4 grid gap-5 px-2 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
                  <div className="text-sm">
                    <p className="font-semibold text-text">Decision basis: {definition.decisionKey}</p>
                    {current ? (
                      <dl className="mt-3 space-y-2 text-muted">
                        <div><dt className="inline">Recorded value: </dt><dd className="inline font-mono text-text">{controlValue(current)}</dd></div>
                        <div><dt className="inline">Decision revision: </dt><dd className="inline text-text">{current.decisionRevision}</dd></div>
                        <div><dt className="inline">Evidence: </dt><dd className="inline text-text">{current.evidenceRef}</dd></div>
                        <div><dt className="inline">Recorded: </dt><dd className="inline text-text">{formatDateTime(current.recordedAt)}</dd></div>
                      </dl>
                    ) : <p className="mt-3 text-muted">No current machine control has been recorded.</p>}
                    {!approvedRevision ? <p className="mt-4 text-sm text-error">The latest {definition.decisionKey} revision is not approved. Complete it in <Link href={`/policy-decisions/${definition.decisionKey}`} className="font-semibold underline">Policy decisions</Link>.</p> : null}
                  </div>
                  {approvedRevision && !isCurrent ? (
                    <ControlForm definition={definition} revisionId={approvedRevision.id} revision={approvedRevision.revision} />
                  ) : isCurrent ? (
                    <p className="rounded-lg bg-surface p-4 text-sm leading-6 text-muted">This control matches the current approved decision. Opening a newer decision revision will automatically mark it stale.</p>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="deferred-finance-heading" className="grid gap-4 rounded-lg bg-card p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div><h2 id="deferred-finance-heading" className="text-base font-semibold text-text">Capabilities deliberately outside P3</h2><p className="mt-1 text-sm leading-6 text-muted">Card checkout, foreign currency, recurring payments and automated evidence deletion remain unavailable until their separate legal, provider and retention approvals exist.</p></div>
        <Link href="/policy-decisions/FIN-04" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-text hover:bg-surface">Review FIN-04</Link>
      </section>
    </div>
  );
}

function approvedCurrent(decision: PolicyDecision | undefined): NonNullable<PolicyDecision['current']> | null {
  return decision?.current?.status === 'approved' && decision.current.id ? decision.current : null;
}

function controlValue(control: FinanceProductionControl): string {
  if (control.integerValue !== null && control.integerValue !== undefined) return control.integerValue.toLocaleString();
  return control.textValue?.replaceAll('_', ' ') ?? '—';
}

function ControlForm({ definition, revisionId, revision }: { definition: ControlDefinition; revisionId: string; revision: number }) {
  return (
    <form action={recordFinanceProductionControl} className="grid gap-4 rounded-lg border border-line bg-card p-5 sm:grid-cols-2">
      <input type="hidden" name="controlKey" value={definition.key} />
      <input type="hidden" name="decisionRevisionId" value={revisionId} />
      <div className="sm:col-span-2"><p className="text-sm font-semibold text-text">Record against {definition.decisionKey} revision {revision}</p><p className="mt-1 text-xs text-muted">This creates a new immutable evidence record.</p></div>
      <label className={`${label} sm:col-span-2`}>Approved value
        {definition.input.kind === 'number' ? (
          <span className="flex items-center gap-3"><input className={field} name="controlValue" type="number" min={definition.input.min} max={definition.input.max} required /><span className="shrink-0 text-xs font-normal text-muted">{definition.input.suffix}</span></span>
        ) : (
          <select className={field} name="controlValue" required>{definition.input.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        )}
      </label>
      <label className={`${label} sm:col-span-2`}>Approval evidence reference<input className={field} name="evidenceRef" minLength={3} maxLength={300} required /></label>
      <label className={`${label} sm:col-span-2`}>Recorded rationale<textarea className={`${field} min-h-24 py-3`} name="reason" minLength={10} maxLength={1000} required /></label>
      <label className="flex items-start gap-3 text-sm text-text sm:col-span-2"><input className="mt-1" type="checkbox" name="confirmApprovedBasis" value="1" required /><span>I verified this exact value and evidence reference against the selected approved decision.</span></label>
      <div className="sm:col-span-2"><SubmitButton>Record immutable control</SubmitButton></div>
    </form>
  );
}
