import type { DueAccessReviews, DueGrant } from '@my-people/api-client';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { reviewGrant } from '@/features/organization/reviewActions';
import { areaText, formatDate } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

const input = 'min-h-11 rounded-lg border border-line px-3 font-normal';

/**
 * D31: this quarter's privileged-access review (FR-AUTH-027, NFR-SEC-13).
 * Every staff role below the reviewer's tier in their areas is confirmed for
 * another quarter or revoked. A role nobody reviews by its deadline stops
 * working on its own; confirming it later restores it.
 */
export default function AccessReviewsPage(props: PageProps<'/access-reviews'>) {
  return (
    <>
      <PageHeader ta="காலாண்டு அணுகல் மீளாய்வு" en="Quarterly access reviews" brd="D31, FR-AUTH-027, NFR-SEC-13, KPI-42" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Reviews searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Reviews({ searchParams }: { searchParams: PageProps<'/access-reviews'>['searchParams'] }) {
  const query = await searchParams;
  let due: DueAccessReviews;
  try {
    due = await (await staffApi()).listDueAccessReviews();
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  // The quarter ends at midnight starting the next one; the last day to decide is the day before.
  const lastDay = new Date(Date.parse(due.quarterEndsAt) - 1).toISOString();
  return (
    <>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <section className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4 text-sm">
        <p className="font-semibold">
          {due.quarter} · decide by {formatDate(lastDay)}
        </p>
        <p>
          Reviewed this quarter: {due.reviewedThisQuarter} of {due.reviewedThisQuarter + due.items.length} (KPI-42 target: all)
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">Waiting for your review</h2>
        {due.items.length === 0 ? <p className="text-sm text-muted">None. Every role in your areas has been reviewed.</p> : null}
        <ul className="flex flex-col gap-2">
          {due.items.map((grant) => (
            <DueRole key={grant.id} grant={grant} />
          ))}
        </ul>
      </section>
    </>
  );
}

function DueRole({ grant }: { grant: DueGrant }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-sm">
      <p className="font-semibold">
        {grant.fullName} <span className="font-mono text-muted">{grant.memberCode}</span>
      </p>
      <p>
        Tier {grant.tier} · {areaText(grant.area)} · granted {formatDate(grant.grantedAt)} · last reviewed{' '}
        {grant.lastReviewedAt ? formatDate(grant.lastReviewedAt) : 'never'}
      </p>
      <p className="flex flex-wrap items-center gap-2">
        {grant.overdue ? <StateTag state="suspended" /> : null}
        {grant.overdue ? `Overdue since ${formatDate(grant.reviewDueAt)}: not working until confirmed` : `Due ${formatDate(grant.reviewDueAt)}`}
      </p>
      <p className="font-mono text-xs text-muted">{grant.permissions.join(', ')}</p>
      <form action={reviewGrant} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="assignmentId" value={grant.id} />
        <label className="flex flex-col gap-1 font-semibold">
          Reason
          <input name="reason" required minLength={3} maxLength={500} className={input} />
        </label>
        <SubmitButton name="decision" value="confirmed">
          Confirm for another quarter
        </SubmitButton>
        <SubmitButton tone="danger" name="decision" value="revoked">
          Revoke
        </SubmitButton>
      </form>
    </li>
  );
}
