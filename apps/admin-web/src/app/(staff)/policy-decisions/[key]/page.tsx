import type { PolicyDecision } from '@my-people/api-client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { createRevision, recordReview, submitRevision, updateDraft } from '@/features/policy-decisions/actions';
import { formatDate, formatDateTime, words } from '@/lib/format';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function PolicyDecisionPage(props: PageProps<'/policy-decisions/[key]'>) {
  const staff = await requireStaff();
  if (!staff.permissions.has('system.configure')) notFound();
  const { key } = await props.params;
  const params = await props.searchParams;
  let decision: PolicyDecision;
  try {
    decision = await (await staffApi()).getPolicyDecision(key);
  } catch (error) {
    if (isRefusal(error)) notFound();
    throw error;
  }

  const current = decision.current;
  const canDraft = !current || current.status === 'approved' || current.status === 'rejected';
  const action = current ? (current.status === 'draft' ? 'Complete and submit this revision' : current.status === 'in_review' ? 'Record the next owner decision' : 'Start a new revision when policy changes') : 'Create the first controlled revision';

  return (
    <div className="flex flex-col gap-6" data-ui>
      <div>
        <Link href="/policy-decisions" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">Back to policy decisions</Link>
        <PageHeader ta={decision.title} en={decision.title} locale="en">
          <StateTag state={current?.status ?? 'not_started'} locale="en" />
        </PageHeader>
        <p className="mt-2 font-mono text-xs text-muted">{decision.key} · {decision.workstream}</p>
      </div>

      <Feedback error={one(params.error)} problems={one(params.problems)} done={one(params.done)} locale="en" />

      <section aria-labelledby="decision-question" className="grid gap-5 rounded-lg bg-card p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:p-6">
        <div>
          <h2 id="decision-question" className="text-lg font-semibold text-text">{decision.question}</h2>
          <p className="mt-3 text-sm leading-6 text-muted"><strong className="text-text">Release effect:</strong> {decision.releaseEffect}</p>
        </div>
        <div className="rounded-lg bg-surface p-4">
          <p className="text-xs font-medium text-muted">Proposed baseline — not an approval</p>
          <p className="mt-2 text-sm leading-6 text-text">{decision.proposedDefault}</p>
        </div>
      </section>

      <section aria-labelledby="approval-path" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="approval-path" className="text-base font-semibold text-text">Required approval evidence</h2>
            <p className="mt-1 text-sm text-muted">{action}</p>
          </div>
          <p className="text-sm tabular-nums text-muted">{decision.approvedRoles.length} of {decision.requiredRoles.length} approved</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {decision.requiredRoles.map((role) => {
            const review = current?.reviews.find((item) => item.role === role);
            return (
              <li key={role} className="rounded-lg border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-text">{words(role)}</h3>
                  <StateTag state={review?.outcome === 'approve' ? 'approved' : review?.outcome === 'reject' ? 'rejected' : 'pending'} locale="en" />
                </div>
                {review ? (
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div><dt className="text-xs text-muted">Reviewer</dt><dd className="text-text">{review.reviewerName}, {review.reviewerTitle}</dd></div>
                    <div><dt className="text-xs text-muted">Evidence</dt><dd className="break-all font-mono text-xs text-text">{review.evidenceRef}</dd></div>
                    <div><dt className="text-xs text-muted">Signed</dt><dd className="text-text">{formatDate(review.reviewedAt)}</dd></div>
                  </dl>
                ) : <p className="mt-4 text-sm text-muted">No signed evidence recorded.</p>}
              </li>
            );
          })}
        </ol>
      </section>

      {current ? (
        <section aria-labelledby="current-revision" className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="current-revision" className="text-base font-semibold text-text">Revision {current.revision}</h2>
              <StateTag state={current.status} locale="en" />
            </div>
            <dl className="mt-5 grid gap-5">
              <div><dt className="text-xs font-medium text-muted">Decision</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">{current.decisionText}</dd></div>
              <div><dt className="text-xs font-medium text-muted">Rationale</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">{current.rationale}</dd></div>
            </dl>
          </div>
          <dl className="grid content-start gap-3 rounded-lg bg-surface p-5 text-sm">
            <div><dt className="text-xs text-muted">Effective from</dt><dd className="mt-1 text-text">{formatDate(current.effectiveFrom)}</dd></div>
            <div><dt className="text-xs text-muted">Updated</dt><dd className="mt-1 text-text">{formatDateTime(current.updatedAt)}</dd></div>
            <div><dt className="text-xs text-muted">Submitted</dt><dd className="mt-1 text-text">{formatDateTime(current.submittedAt)}</dd></div>
            <div><dt className="text-xs text-muted">Resolved</dt><dd className="mt-1 text-text">{formatDateTime(current.resolvedAt)}</dd></div>
          </dl>
        </section>
      ) : null}

      {current?.status === 'draft' ? (
        <section aria-labelledby="edit-draft" className="rounded-lg bg-card p-5 sm:p-6">
          <h2 id="edit-draft" className="text-base font-semibold text-text">Edit draft revision</h2>
          <DecisionForm keyValue={decision.key} revisionId={current.id} current={current} action={updateDraft} submitAction={submitRevision} />
        </section>
      ) : null}

      {current?.status === 'in_review' ? (
        <section aria-labelledby="record-review" className="rounded-lg bg-card p-5 sm:p-6">
          <h2 id="record-review" className="text-base font-semibold text-text">Record signed owner evidence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Record only an approval or rejection that already exists in the controlled source document. This screen does not grant authority to approve policy.</p>
          <form action={recordReview} className="mt-5 grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="key" value={decision.key} /><input type="hidden" name="revisionId" value={current.id} />
            <Field label="Owner role"><select name="role" required defaultValue="" className={inputClass}><option value="" disabled>Select an outstanding role</option>{decision.missingRoles.map((role) => <option key={role} value={role}>{words(role)}</option>)}</select></Field>
            <Field label="Outcome"><select name="outcome" required defaultValue="approve" className={inputClass}><option value="approve">Approve</option><option value="reject">Reject</option></select></Field>
            <Field label="Reviewer name"><input name="reviewerName" required minLength={2} autoComplete="name" className={inputClass} /></Field>
            <Field label="Official title"><input name="reviewerTitle" required minLength={2} className={inputClass} /></Field>
            <Field label="Signed evidence reference"><input name="evidenceRef" required minLength={3} className={`${inputClass} font-mono`} aria-describedby="evidence-help" /><span id="evidence-help" className="text-xs text-muted">Use the controlled minutes, signature record or document reference. Do not paste secrets or personal documents.</span></Field>
            <Field label="Signature date"><input type="date" name="reviewedAt" required max={todayInSriLanka()} className={inputClass} /></Field>
            <label className="flex flex-col gap-2 text-sm font-medium text-text lg:col-span-2">Review comment<textarea name="comment" required minLength={10} rows={4} className={inputClass} /></label>
            <label className="flex items-start gap-3 text-sm text-text lg:col-span-2"><input type="checkbox" name="confirmEvidence" value="1" required className="mt-1 h-5 w-5" /><span>I verified the referenced signed record and confirm these details match it.</span></label>
            <div className="lg:col-span-2"><SubmitButton>Record owner decision</SubmitButton></div>
          </form>
        </section>
      ) : null}

      {canDraft ? (
        <section aria-labelledby="new-revision" className="rounded-lg bg-card p-5 sm:p-6">
          <h2 id="new-revision" className="text-base font-semibold text-text">{current ? 'Start a replacement revision' : 'Create the first revision'}</h2>
          <p className="mt-2 text-sm text-muted">{current ? 'Approved and rejected evidence remains unchanged. A policy change starts a new revision.' : 'Write the proposed decision and rationale before requesting owner signatures.'}</p>
          <DecisionForm keyValue={decision.key} current={current ?? undefined} action={createRevision} />
        </section>
      ) : null}
    </div>
  );
}

const inputClass = 'min-h-11 rounded-lg border border-line bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-2 text-sm font-medium text-text">{label}{children}</label>;
}

function todayInSriLanka(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function DecisionForm({ keyValue, revisionId, current, action, submitAction }: { keyValue: string; revisionId?: string; current?: { decisionText: string; rationale: string; effectiveFrom?: string | null }; action: (formData: FormData) => Promise<void>; submitAction?: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="key" value={keyValue} />{revisionId ? <input type="hidden" name="revisionId" value={revisionId} /> : null}
      <Field label="Decision text"><textarea name="decisionText" required minLength={10} maxLength={4000} rows={5} defaultValue={current?.decisionText} className={inputClass} /></Field>
      <Field label="Rationale"><textarea name="rationale" required minLength={10} maxLength={4000} rows={5} defaultValue={current?.rationale} className={inputClass} /></Field>
      <Field label="Effective date"><input type="date" name="effectiveFrom" defaultValue={current?.effectiveFrom ?? ''} className={inputClass} /></Field>
      {submitAction ? (
        <div className="rounded-lg bg-surface p-4">
          <Field label="Submission reason"><input name="reason" minLength={10} className={inputClass} /></Field>
          <label className="mt-4 flex items-start gap-3 text-sm text-text"><input type="checkbox" name="confirmSubmit" value="1" className="mt-1 h-5 w-5" /><span>Submit this immutable revision to every required policy owner.</span></label>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3"><SubmitButton>{revisionId ? 'Save draft' : 'Create draft'}</SubmitButton>{submitAction ? <SubmitButton formAction={submitAction} tone="secondary">Submit for owner review</SubmitButton> : null}</div>
    </form>
  );
}
