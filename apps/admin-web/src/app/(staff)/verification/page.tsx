import type { ReviewState } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

const STATES: ReviewState[] = ['submitted', 'in_review', 'needs_update', 'verified', 'unable_to_verify'];
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** W01: the review queue for the reviewer's own areas, oldest waiting first (FR-WEB-001 to 004). */
export default function VerificationQueuePage(props: PageProps<'/verification'>) {
  return (
    <>
      <PageHeader ta="அடையாளச் சரிபார்ப்பு வரிசை" en="Verification queue" brd="W01, FR-WEB-001 to 005" />
      <Suspense fallback={<p className="text-muted">… Loading the queue</p>}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<'/verification'>['searchParams'] }) {
  const params = await searchParams;
  const state = one(params.state) as ReviewState | undefined;
  const mine = one(params.mine) === '1';
  const ref = one(params.ref)?.trim() || undefined;
  const api = await staffApi();
  let reviews;
  let counts;
  try {
    [reviews, counts] = await Promise.all([
      api.listIdentityReviews({ states: state && STATES.includes(state) ? [state] : undefined, mine, ref, limit: 100 }),
      api.getIdentityReviewCounts(),
    ]);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }

  return (
    <>
      <p className="text-sm text-muted">
        {counts.awaitingReview} waiting · {counts.needsUpdate} with the member · {counts.assignedToMe} claimed by you
      </p>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          State
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-2">
            <option value="">Open (waiting, in review, with the member)</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} /> Claimed by me
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Review reference
          <input name="ref" defaultValue={ref} placeholder="VR-00421" className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Show
        </button>
      </form>
      {reviews.length === 0 ? <p className="text-sm text-muted">No reviews match.</p> : null}
      <div hidden={reviews.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Identity reviews</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Reference</th>
              <th scope="col" className="px-3 py-2">State</th>
              <th scope="col" className="px-3 py-2">Route</th>
              <th scope="col" className="px-3 py-2">Area</th>
              <th scope="col" className="px-3 py-2">Submitted</th>
              <th scope="col" className="px-3 py-2">Claimed by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reviews.map((review) => (
              <tr key={review.id}>
                <td className="px-3 py-2">
                  <Link href={`/verification/${review.id}`} className="font-mono font-semibold text-primary underline">
                    {review.reviewRef}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StateTag state={review.state} />
                </td>
                <td className="px-3 py-2">{review.route.toUpperCase()}</td>
                <td className="px-3 py-2">{areaText(review.area)}</td>
                <td className="px-3 py-2">{formatDateTime(review.resubmittedAt ?? review.submittedAt)}</td>
                <td className="px-3 py-2">{review.claimedByName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
