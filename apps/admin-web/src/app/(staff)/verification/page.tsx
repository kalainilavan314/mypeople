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

/** The review queue for the reviewer's own areas, oldest waiting first. */
export default function VerificationQueuePage(props: PageProps<'/verification'>) {
  return (
    <>
      <PageHeader ta="அடையாளச் சரிபார்ப்பு வரிசை" en="Verification queue" />
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
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang="ta" className="font-semibold text-text">
          {counts.awaitingReview} காத்திருக்கின்றன · {counts.needsUpdate} உறுப்பினருக்காக · {counts.assignedToMe} உங்களிடம்
        </p>
        <p className="text-xs text-muted">
          {counts.awaitingReview} waiting · {counts.needsUpdate} with the member · {counts.assignedToMe} claimed by you
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">நிலை</span>
          <span lang="en" className="text-xs">State</span>
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
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
          <span>
            <span lang="ta" className="block text-xs font-semibold text-text">எனக்குரியவை</span>
            <span lang="en" className="block text-xs text-muted">Claimed by me</span>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">சரிபார்ப்புக் குறிப்பு</span>
          <span lang="en" className="text-xs">Review reference</span>
          <input name="ref" defaultValue={ref} placeholder="VR-00421" className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          <span className="flex flex-col items-center">
            <span lang="ta">காட்டுக</span>
            <span lang="en" className="text-xs font-normal opacity-90">Show</span>
          </span>
        </button>
      </form>
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 text-center">
          <p lang="ta" className="text-sm font-semibold text-muted">
            சரிபார்ப்புகள் எதுவும் பொருந்தவில்லை.
          </p>
          <p className="text-xs text-muted">No identity reviews match the selected filters.</p>
        </div>
      ) : null}
      <div hidden={reviews.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Identity reviews</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">
                <span lang="ta" className="block text-text font-semibold">குறிப்பு எண்</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Reference</span>
              </th>
              <th scope="col" className="px-3 py-2">
                <span lang="ta" className="block text-text font-semibold">நிலை</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">State</span>
              </th>
              <th scope="col" className="px-3 py-2">
                <span lang="ta" className="block text-text font-semibold">ஆவண வகை</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Route</span>
              </th>
              <th scope="col" className="px-3 py-2">
                <span lang="ta" className="block text-text font-semibold">பகுதி</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Area</span>
              </th>
              <th scope="col" className="px-3 py-2">
                <span lang="ta" className="block text-text font-semibold">சமர்ப்பிக்கப்பட்டது</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Submitted</span>
              </th>
              <th scope="col" className="px-3 py-2">
                <span lang="ta" className="block text-text font-semibold">பொறுப்பேற்றவர்</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Claimed by</span>
              </th>
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
