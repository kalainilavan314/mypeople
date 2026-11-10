import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import {
  approveContributionAction,
  claimContributionAction,
  reconcileContributionAction,
} from '@/features/finance/actions';
import { SlipViewer } from '@/features/finance/SlipViewer';
import { formatDateTime } from '@/lib/format';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function FinanceDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Loading contribution details…</p>}>
      <ContributionDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ContributionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const staff = await requireStaff();

  const api = await staffApi();
  let contribution;
  try {
    contribution = await api.getFinanceContribution(id);
  } catch (err) {
    return (
      <div className="rounded-xl border border-error/20 bg-error-bg p-6 text-error">
        Unable to load contribution record: {(err as Error).message}
      </div>
    );
  }

  const hasReviewPermission = staff.permissions.has('finance.review');
  const hasApprovePermission = staff.permissions.has('finance.approve');

  // Check separation of duties: reviewer cannot be the approver
  const isReviewer =
    Boolean(contribution.reconciliation?.reviewedBy && contribution.reconciliation.reviewedBy === staff.member.id) ||
    Boolean(contribution.claimedBy && contribution.claimedBy === staff.member.id);

  const doneParam = one(query.done);
  const errorParam = one(query.error);
  const problemsParam = one(query.problems);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        ta={`Contribution ${contribution.contributionRef}`}
        en={`Contribution ${contribution.contributionRef}`}
        locale="en">
        <Link href="/finance" className="text-sm font-medium text-primary underline">
          ← Back to finance queue
        </Link>
      </PageHeader>

      <Feedback
        done={doneParam}
        error={errorParam}
        problems={problemsParam ? problemsParam.split(',') : []}
      />

      {/* Risk flags banner */}
      {contribution.riskFlags && contribution.riskFlags.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Automated risk warnings detected
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">
            {contribution.riskFlags.includes('duplicate_bank_reference') ? (
              <li>
                <strong>Duplicate bank reference:</strong> This transaction reference has been seen on another contribution record.
              </li>
            ) : null}
            {contribution.riskFlags.includes('enhanced_review_threshold') ? (
              <li>
                <strong>Enhanced review threshold:</strong> Contribution amount is 100,000 LKR or greater, requiring senior audit scrutiny.
              </li>
            ) : null}
            {contribution.riskFlags.includes('third_party_payment') ? (
              <li>
                <strong>Third-party payment:</strong> Donor did not confirm payment from personal account.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Main Grid: Details & Evidence */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Contribution Details & Declarations */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-base font-semibold text-text">Contribution Overview</h3>
            <dl className="mt-4 divide-y divide-line text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Contribution Ref</dt>
                <dd className="font-mono font-bold text-text">{contribution.contributionRef}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Current Status</dt>
                <dd>
                <StateTag state={contribution.status.toLowerCase()} locale="en" />
                </dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Amount</dt>
                <dd className="font-semibold text-text">
                  {(contribution.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                  {contribution.currency}
                </dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Transfer Date</dt>
                <dd className="text-text">{contribution.transferDate}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Bank Reference</dt>
                <dd className="font-mono font-semibold text-text">{contribution.bankReference}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Donor Member</dt>
                <dd className="font-mono text-text">{contribution.donorMemberCode ?? '—'}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-muted">Initiated</dt>
                <dd className="text-text">
                  {contribution.timeline[0]?.occurredAt
                    ? formatDateTime(contribution.timeline[0].occurredAt)
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Declarations Card */}
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-base font-semibold text-text">Donor Declarations</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <span className={contribution.noPrivilegeAcknowledged ? 'text-success font-semibold' : 'text-error font-semibold'}>
                  {contribution.noPrivilegeAcknowledged ? 'Confirmed' : 'Missing'}
                </span>
                <p className="text-text">
                  <strong>No privilege acknowledged:</strong> Donor confirmed contribution grants no political, membership, or service privilege.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className={contribution.informationAccurateAcknowledged ? 'text-success font-semibold' : 'text-error font-semibold'}>
                  {contribution.informationAccurateAcknowledged ? 'Confirmed' : 'Missing'}
                </span>
                <p className="text-text">
                  <strong>Accuracy acknowledged:</strong> Donor confirmed details and slip are true and accurate.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className={contribution.payingForSelf ? 'text-success font-semibold' : 'text-warning font-semibold'}>
                  {contribution.payingForSelf ? 'Self-paid' : 'Third-party'}
                </span>
                <p className="text-text">
                  <strong>Personal funds:</strong> {contribution.payingForSelf ? 'Paid from personal funds on own behalf.' : 'Flagged as potential third-party payment.'}
                </p>
              </div>
            </div>
          </div>

          {/* Claim Case Card */}
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-base font-semibold text-text">Case Ownership</h3>
            <div className="mt-2 text-sm text-text">
              {contribution.claimedByName ? (
                <p>
                  Claimed by <span className="font-semibold">{contribution.claimedByName}</span>
                  {contribution.claimedAt ? ` on ${formatDateTime(contribution.claimedAt)}` : ''}
                </p>
              ) : (
                <p className="text-muted">This case is currently unclaimed in the operational queue.</p>
              )}
            </div>
            {!contribution.claimedBy &&
            hasReviewPermission &&
            contribution.status === 'SUBMITTED' ? (
              <form action={claimContributionAction} className="mt-4">
                <input type="hidden" name="contributionId" value={contribution.id} />
                <SubmitButton tone="primary">Claim Case for Review</SubmitButton>
              </form>
            ) : null}
            {hasReviewPermission &&
            contribution.status === 'ON_HOLD' &&
            (!contribution.claimedBy || contribution.claimedBy === staff.member.id) ? (
              <form action={claimContributionAction} className="mt-4">
                <input type="hidden" name="contributionId" value={contribution.id} />
                <SubmitButton tone="primary">Resume Review</SubmitButton>
              </form>
            ) : null}
          </div>
        </div>

        {/* Right Column: Slip Evidence & Decision Workflows */}
        <div className="flex flex-col gap-6">
          {/* Slip Evidence Card */}
          <SlipViewer contributionId={contribution.id} hasSlip={contribution.hasSlip} />

          {/* Section A: Bank Statement Reconciliation (Reviewer) */}
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-base font-semibold text-text">Step 1: Bank Statement Reconciliation</h3>
            <p className="mt-1 text-xs text-muted">
              Verify the transfer slip against the party bank account credit statement.
            </p>

            {contribution.reconciliation ? (
              <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-xs space-y-2">
                <p className="font-semibold text-success">Reconciled with bank statement</p>
                <p>
                  <strong>Statement Reference:</strong>{' '}
                  <span className="font-mono">{contribution.reconciliation.statementReference}</span>
                </p>
                <p>
                  <strong>Reconciled At:</strong> {formatDateTime(contribution.reconciliation.reviewedAt)}
                </p>
                {contribution.reconciliation.reason ? (
                  <p>
                    <strong>Reviewer Note:</strong> {contribution.reconciliation.reason}
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasReviewPermission &&
            (contribution.status === 'SUBMITTED' || contribution.status === 'PENDING_REVIEW') ? (
              <form action={reconcileContributionAction} className="mt-4 space-y-4">
                <input type="hidden" name="contributionId" value={contribution.id} />

                <div>
                  <label htmlFor="reconcile-action" className="block text-xs font-semibold text-text">
                    Reconciliation Action
                  </label>
                  <select
                    id="reconcile-action"
                    name="action"
                    required
                    defaultValue="matched"
                    className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                    <option value="matched">Matched (Credit Confirmed on Statement)</option>
                    <option value="needs_correction">Needs Correction (Request Updated Slip)</option>
                    <option value="hold">Hold (Under Investigation)</option>
                    <option value="reject">Reject (No Bank Credit Found)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stmt-ref" className="block text-xs font-semibold text-text">
                    Bank Statement Line / Reference (Required for Matched)
                  </label>
                  <input
                    type="text"
                    id="stmt-ref"
                    name="statementReference"
                    placeholder="e.g. STMT-202611-0045"
                    className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="reconcile-reason" className="block text-xs font-semibold text-text">
                    Reviewer Notes / Reason (min 5 characters)
                  </label>
                  <textarea
                    id="reconcile-reason"
                    name="reason"
                    required
                    minLength={5}
                    rows={2}
                    placeholder="State reason or statement verification details"
                    className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  />
                </div>

                <SubmitButton tone="primary">Submit Reconciliation</SubmitButton>
              </form>
            ) : null}
          </div>

          {/* Section B: Independent Second-Person Approval (Approver) */}
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-base font-semibold text-text">Step 2: Independent Second-Person Approval</h3>
            <p className="mt-1 text-xs text-muted">
              Must be performed by an independent staff member separate from the reviewer and donor.
            </p>

            {contribution.receipt ? (
              <div className="mt-4 rounded-xl border border-success/30 bg-success-bg/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-success">OFFICIAL RECEIPT ISSUED</p>
                    <p className="font-mono text-xl font-bold text-success">{contribution.receipt.receiptCode}</p>
                  </div>
                  <span className="text-xs font-semibold text-success">Verified</span>
                </div>
                <div className="text-xs text-muted space-y-1 pt-2 border-t border-line">
                  <p>
                    <strong>Issued At:</strong> {formatDateTime(contribution.receipt.issuedAt)}
                  </p>
                  <p>
                    <strong>Approved Amount:</strong>{' '}
                    {(contribution.receipt.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                    {contribution.receipt.currency}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Separation of duties alert if reviewer tries to self-approve */}
            {isReviewer && contribution.status === 'APPROVAL_PENDING' ? (
              <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-xs text-muted">
                <strong>Separation of duties required:</strong> You reviewed or claimed this contribution. A second, independent staff member must conduct final approval.
              </div>
            ) : null}

            {hasApprovePermission &&
            !isReviewer &&
            contribution.status === 'APPROVAL_PENDING' ? (
              <form action={approveContributionAction} className="mt-4 space-y-4">
                <input type="hidden" name="contributionId" value={contribution.id} />

                <div>
                  <label htmlFor="approve-action" className="block text-xs font-semibold text-text">
                    Approval Decision
                  </label>
                  <select
                    id="approve-action"
                    name="action"
                    required
                    defaultValue="approve"
                    className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                    <option value="approve">Approve (Issue Official CN- Receipt)</option>
                    <option value="hold">Hold (Require Audit Query)</option>
                    <option value="reject">Reject</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-xs text-text">
                    <input
                      type="checkbox"
                      name="confirmIndependentReview"
                      value="1"
                      required
                      className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary"
                    />
                    <span>I confirm independent verification of reconciliation records without bias.</span>
                  </label>

                  <label className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <input
                      type="checkbox"
                      name="relatedPartyConflict"
                      value="1"
                      className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary"
                    />
                    <span>
                      Declare related-party or personal conflict of interest with donor (disables approval).
                    </span>
                  </label>
                </div>

                <div>
                  <label htmlFor="approve-reason" className="block text-xs font-semibold text-text">
                    Approval Notes / Rationale (min 5 characters)
                  </label>
                  <textarea
                    id="approve-reason"
                    name="reason"
                    required
                    minLength={5}
                    rows={2}
                    placeholder="Document independent approval verification rationale"
                    className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  />
                </div>

                <SubmitButton tone="primary">Execute Approval Decision</SubmitButton>
              </form>
            ) : null}
          </div>

          {/* Section C: Timeline & Audit History */}
          <div className="rounded-xl border border-line bg-card p-6">
            <h3 className="text-base font-semibold text-text">Audit Timeline</h3>
            <div className="mt-4 space-y-4">
              {contribution.timeline.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-line pl-3 py-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <StateTag state={entry.toStatus.toLowerCase()} locale="en" />
                      <span className="text-muted">{formatDateTime(entry.occurredAt)}</span>
                    </div>
                    {entry.reason ? <p className="mt-1 text-text">{entry.reason}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
