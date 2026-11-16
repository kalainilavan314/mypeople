import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import {
  publishPolicyVersion,
  recordTier5Certification,
  saveOperationalControl,
} from '@/features/operations/actions';
import { formatDate } from '@/lib/format';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const field = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm font-semibold text-text';
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function OperationsGovernancePage(props: PageProps<'/operations-governance'>) {
  return (
    <>
      <PageHeader ta="Operations and governance" en="Operations and governance" locale="en" />
      <Suspense fallback={<ConsoleLoading />}>
        <ClosureConsole searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ClosureConsole({ searchParams }: { searchParams: PageProps<'/operations-governance'>['searchParams'] }) {
  const staff = await requireStaff();
  if (!staff.permissions.has('system.configure')) notFound();
  const api = await staffApi();
  const [readiness, decisions, policies, assignments, certifications, query] = await Promise.all([
    api.getOperationalReadiness(),
    api.listPolicyDecisions(),
    api.listGovernancePolicies(),
    api.listTier5Assignments(),
    api.listTier5Certifications(),
    searchParams,
  ]);
  const approved = decisions.filter((item) => item.current?.status === 'approved' && item.current.id);
  const ready = readiness.items.filter((item) => item.ready).length;
  const blocked = readiness.items.length - ready;

  return (
    <div className="flex flex-col gap-8" data-ui>
      <Feedback error={one(query.error)} problems={one(query.problems)} done={one(query.done)} />

      <section aria-labelledby="closure-question" className="rounded-lg bg-card p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end">
          <div>
            <h2 id="closure-question" className="text-lg font-semibold text-text">
              What still prevents staff and governance operations from opening safely?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Operational values must cite approved decision revisions. Proposed defaults never activate offline attendance or aggregate publication.
            </p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface px-2 py-4">
            <div className="px-3"><dt className="text-xs text-muted">Blocked controls</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{blocked}</dd></div>
            <div className="px-3"><dt className="text-xs text-muted">Ready controls</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{ready}</dd></div>
            <div className="px-3"><dt className="text-xs text-muted">Tier 5 certified</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{readiness.tier5Certified} / {readiness.tier5Assignments}</dd></div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="readiness-heading">
        <div className="mb-3"><h2 id="readiness-heading" className="text-base font-semibold text-text">Operational readiness</h2><p className="mt-1 text-sm text-muted">Current server-enforced release state</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="px-3 py-3 font-medium">Control</th><th className="px-3 py-3 font-medium">Basis</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 text-right font-medium">Value</th></tr></thead>
            <tbody className="divide-y divide-line border-y border-line">
              {readiness.items.map((item) => <tr key={item.key}><td className="px-3 py-4"><p className="font-semibold text-text">{item.key.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted">{item.reason}</p></td><td className="px-3 py-4 font-mono text-xs text-muted">{item.decisionKey ?? 'Approved publication evidence'}</td><td className="px-3 py-4"><StateTag state={item.ready ? 'approved' : 'blocked'} locale="en" /></td><td className="px-3 py-4 text-right font-mono tabular-nums text-text">{item.value ?? '—'}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section aria-labelledby="controls-heading" className="rounded-lg border border-line bg-card p-5">
          <h2 id="controls-heading" className="text-base font-semibold text-text">Record an approved operational value</h2>
          <p className="mt-1 text-sm text-muted">Creates an immutable version. It does not edit the decision record.</p>
          <form action={saveOperationalControl} className="mt-5 flex flex-col gap-4">
            <label className={label}>Control<select className={field} name="controlKey" required><option value="offline_attendance_replay_hours">Offline attendance replay hours</option><option value="aggregate_minimum_group_size">Aggregate minimum group size</option></select></label>
            <label className={label}>Approved decision revision<select className={field} name="decisionRevisionId" required><option value="">Select an approved revision</option>{approved.filter((item) => ['STF-01', 'GOV-01'].includes(item.key)).map((item) => <option key={item.current!.id} value={item.current!.id}>{item.key} · revision {item.current!.revision}</option>)}</select></label>
            <label className={label}>Integer value<input className={field} name="integerValue" type="number" min="1" max="1000" required /></label>
            <label className={label}>Reason<textarea className={`${field} min-h-24 py-3`} name="reason" minLength={10} maxLength={1000} required /></label>
            <label className="flex items-start gap-3 text-sm text-text"><input className="mt-1" type="checkbox" name="confirmApprovedBasis" value="1" required /><span>I verified that this exact value is supported by the selected approved revision.</span></label>
            <SubmitButton>Record control version</SubmitButton>
          </form>
        </section>

        <section aria-labelledby="policy-heading" className="rounded-lg border border-line bg-card p-5">
          <h2 id="policy-heading" className="text-base font-semibold text-text">Publish an immutable policy version</h2>
          <p className="mt-1 text-sm text-muted">{policies.length} versions recorded. English and Tamil are separate evidence records.</p>
          <form action={publishPolicyVersion} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={label}>Policy key<input className={field} name="policyKey" maxLength={80} required /></label>
            <label className={label}>Version<input className={field} name="version" maxLength={40} required /></label>
            <label className={label}>Type<select className={field} name="policyType"><option value="privacy_notice">Privacy notice</option><option value="terms">Terms</option><option value="optional_consent">Optional consent</option><option value="election_rule">Election rule</option></select></label>
            <label className={label}>Locale<select className={field} name="locale"><option value="en">English</option><option value="ta">Tamil</option></select></label>
            <label className={`${label} sm:col-span-2`}>Approval evidence reference<input className={field} name="approvalReference" maxLength={300} required /></label>
            <label className={label}>Approved at<input className={field} name="approvedAt" type="datetime-local" required /></label>
            <label className={label}>Effective from<input className={field} name="effectiveFrom" type="datetime-local" required /></label>
            <label className={`${label} sm:col-span-2`}>Policy content<textarea className={`${field} min-h-32 py-3`} name="contentText" required /></label>
            <label className="flex items-start gap-3 text-sm text-text sm:col-span-2"><input className="mt-1" type="checkbox" name="confirmImmutablePublication" value="1" required /><span>I verified the approval reference and understand that this version cannot be edited or deleted.</span></label>
            <div className="sm:col-span-2"><SubmitButton>Publish version</SubmitButton></div>
          </form>
        </section>
      </div>

      <section aria-labelledby="tier5-heading" className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        <div><h2 id="tier5-heading" className="text-base font-semibold text-text">Tier 5 external certification</h2><p className="mt-1 text-sm leading-6 text-muted">Ordinary access review cannot certify Tier 5. Record only the reference to an independently reviewed decision; do not upload confidential evidence here.</p><p className="mt-4 text-sm text-text">{certifications.length} certification records · {assignments.filter((item) => item.state === 'active').length} active Tier 5 grants</p></div>
        <form action={recordTier5Certification} className="grid gap-4 rounded-lg border border-line bg-card p-5 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>Tier 5 assignment<select className={field} name="assignmentId" required><option value="">Select an assignment</option>{assignments.map((item) => <option key={item.assignmentId} value={item.assignmentId}>{item.fullName} · {item.memberCode} · {item.state}</option>)}</select></label>
          <label className={label}>Decision<select className={field} name="decision"><option value="certified">Certified</option><option value="revoked_required">Revocation required</option></select></label>
          <label className={label}>Certification date<input className={field} name="certifiedAt" type="date" max={new Date().toISOString().slice(0, 10)} required /></label>
          <label className={label}>Period start<input className={field} name="periodStart" type="date" required /></label>
          <label className={label}>Period end<input className={field} name="periodEnd" type="date" required /></label>
          <label className={label}>External reviewer<input className={field} name="reviewerName" required /></label>
          <label className={label}>Reviewer title<input className={field} name="reviewerTitle" required /></label>
          <label className={`${label} sm:col-span-2`}>Evidence reference<input className={field} name="evidenceRef" maxLength={300} required /></label>
          <label className={`${label} sm:col-span-2`}>Recorded rationale<textarea className={`${field} min-h-24 py-3`} name="reason" minLength={10} maxLength={1000} required /></label>
          <label className="flex items-start gap-3 text-sm text-text sm:col-span-2"><input className="mt-1" type="checkbox" name="confirmExternalReview" value="1" required /><span>I am recording external certification evidence, not self-certifying this grant.</span></label>
          <div className="sm:col-span-2"><SubmitButton>Record certification</SubmitButton></div>
        </form>
      </section>

      {certifications.length ? <section aria-labelledby="cert-history"><h2 id="cert-history" className="text-base font-semibold text-text">Certification history</h2><ul className="mt-3 divide-y divide-line border-y border-line">{certifications.slice(0, 8).map((item) => <li key={item.id} className="grid gap-2 py-4 text-sm md:grid-cols-[1fr_auto]"><div><p className="font-semibold text-text">{item.fullName} · <span className="font-mono">{item.memberCode}</span></p><p className="mt-1 text-muted">{item.reviewerName}, {item.reviewerTitle} · {item.evidenceRef}</p></div><div className="md:text-right"><StateTag state={item.decision === 'certified' ? 'approved' : 'blocked'} locale="en" /><p className="mt-1 font-mono text-xs text-muted">to {formatDate(item.periodEnd)}</p></div></li>)}</ul></section> : null}
    </div>
  );
}
