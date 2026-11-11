import type { ReviewState } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ConsolePagination } from '@/components/ConsolePagination';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime } from '@/lib/format';
import { loadAreaNames } from '@/lib/areas';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { CONSOLE_PAGE_SIZE, consolePage } from '@/lib/pagination';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const STATES: ReviewState[] = ['submitted', 'in_review', 'needs_update', 'verified', 'unable_to_verify'];
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The review queue for the reviewer's own areas, oldest waiting first. */
export default function VerificationQueuePage(props: PageProps<'/verification'>) {
  return (
    <>
      <PageHeader ta="அடையாளச் சரிபார்ப்பு வரிசை" en="Verification queue" />
      <Suspense fallback={<ConsoleLoading rows={5} />}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<'/verification'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const params = await searchParams;
  const state = one(params.state) as ReviewState | undefined;
  const mine = one(params.mine) === '1';
  const ref = one(params.ref)?.trim() || undefined;
  const page = consolePage(params.page);
  const api = await staffApi();
  let reviews;
  let counts;
  try {
    [reviews, counts] = await Promise.all([
      api.listIdentityReviews({ states: state && STATES.includes(state) ? [state] : undefined, mine, ref, limit: CONSOLE_PAGE_SIZE + 1, offset: (page - 1) * CONSOLE_PAGE_SIZE }),
      api.getIdentityReviewCounts(),
    ]);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }

  const hasMore = reviews.length > CONSOLE_PAGE_SIZE;
  reviews = reviews.slice(0, CONSOLE_PAGE_SIZE);
  const areaNames = await loadAreaNames(reviews.map((review) => review.area));

  return (
    <>
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang={locale} className="font-semibold text-text">
          {locale === 'ta'
            ? `${counts.awaitingReview} காத்திருக்கின்றன · ${counts.needsUpdate} உறுப்பினரிடம் · ${counts.assignedToMe} உங்களிடம்`
            : `${counts.awaitingReview} waiting · ${counts.needsUpdate} with member · ${counts.assignedToMe} claimed by you`}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">{locale === 'ta' ? 'நிலை' : 'State'}</span>
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-2">
            <option value="">{locale === 'ta' ? 'திறந்தவை (காத்திருப்பவை, மதிப்பாய்வில், திருத்தம் கோரியவை)' : 'Open (waiting, in review, with member)'}</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
          <span lang={locale} className="font-semibold text-text">
            {locale === 'ta' ? 'எனக்குரியவை' : 'Claimed by me'}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">{locale === 'ta' ? 'சரிபார்ப்புக் குறிப்பு' : 'Review reference'}</span>
          <input name="ref" defaultValue={ref} placeholder="VR-00421" className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>

        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          <span lang={locale}>{locale === 'ta' ? 'காட்டுக' : 'Filter'}</span>
        </button>
      </form>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 text-center">
          <p lang={locale} className="text-sm font-semibold text-muted">
            {locale === 'ta' ? 'சரிபார்ப்புகள் எதுவும் பொருந்தவில்லை.' : 'No identity reviews match the selected filters.'}
          </p>
        </div>
      ) : null}

      <div hidden={reviews.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Identity reviews</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'குறிப்பு எண்' : 'Reference'}</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'நிலை' : 'State'}</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'ஆவண வகை' : 'Route'}</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'பகுதி' : 'Area'}</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'சமர்ப்பிக்கப்பட்டது' : 'Submitted'}</span>
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'பொறுப்பேற்றவர்' : 'Claimed by'}</span>
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
                <td className="px-3 py-2"><span lang={locale}>{areaText(review.area, areaNames, locale)}</span></td>
                <td className="px-3 py-2">{formatDateTime(review.resubmittedAt ?? review.submittedAt)}</td>
                <td className="px-3 py-2">{review.claimedByName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConsolePagination pathname="/verification" page={page} hasMore={hasMore} filters={{ state: state && STATES.includes(state) ? state : undefined, mine: mine ? '1' : undefined, ref }} />
    </>
  );
}
