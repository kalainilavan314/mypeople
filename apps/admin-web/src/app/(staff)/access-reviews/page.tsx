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
 * Quarterly privileged-access review: every staff role below the reviewer's tier in their
 * assigned areas is confirmed for another quarter or revoked. A role unreviewed by its
 * deadline stops working on its own until re-confirmed.
 */
export default function AccessReviewsPage(props: PageProps<'/access-reviews'>) {
  return (
    <>
      <PageHeader ta="காலாண்டு அணுகல் மீளாய்வு" en="Quarterly access reviews" />
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
        <p lang="ta" className="text-xs font-semibold text-muted">
          காலாண்டு மீளாய்வு நிலை: {due.quarter}
        </p>
        <p className="font-semibold">
          {due.quarter} · decide by {formatDate(lastDay)}
        </p>
        <p className="text-muted">
          Reviewed this quarter: {due.reviewedThisQuarter} of {due.reviewedThisQuarter + due.items.length} (target: 100% completion)
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="flex flex-col text-base font-bold">
          <span lang="ta">உங்கள் மீளாய்வுக்காகக் காத்திருப்பவை</span>
          <span lang="en" className="text-xs font-normal text-muted">Waiting for your review</span>
        </h2>
        {due.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 text-center text-muted">
            <p lang="ta" className="text-sm font-semibold">
              மீளாய்வுக்காக எதுவும் நிலுவையில் இல்லை
            </p>
            <p className="text-xs">All staff roles in your assigned areas have been reviewed for this quarter.</p>
          </div>
        ) : null}
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
      <form action={reviewGrant} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="assignmentId" value={grant.id} />
        <label htmlFor="input-reason" className="flex flex-col gap-1 font-semibold">
          <span lang="ta" className="text-xs text-muted">காரணம் *</span>
          <span lang="en" className="text-xs">Reason *</span>
          <input
            id="input-reason"
            name="reason"
            required
            minLength={3}
            maxLength={500}
            className={input}
          />
        </label>
        <label className="flex items-start gap-2 text-xs font-medium text-muted">
          <input
            type="checkbox"
            id="input-confirm"
            name="confirmReview"
            value="1"
            required
            className="mt-0.5 rounded border-line"
          />
          <span>
            <span lang="ta" className="block font-semibold text-text">
              இக்காலாண்டு அணுகல் மீளாய்வுத் தீர்மானத்தை உறுதிப்படுத்துகிறேன்.
            </span>
            <span lang="en" className="block text-muted">
              I confirm this quarterly access review decision and its recorded justification.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="confirmed">
            <span className="flex flex-col items-center">
              <span lang="ta">அடுத்த காலாண்டிற்கு உறுதிப்படுத்துக</span>
              <span lang="en" className="text-xs font-normal opacity-90">Confirm for another quarter</span>
            </span>
          </SubmitButton>
          <SubmitButton tone="danger" name="decision" value="revoked">
            <span className="flex flex-col items-center">
              <span lang="ta">பொறுப்பை முடிவுக்குக் கொண்டுவருக</span>
              <span lang="en" className="text-xs font-normal opacity-90">Revoke role</span>
            </span>
          </SubmitButton>
        </div>
      </form>
    </li>
  );
}
