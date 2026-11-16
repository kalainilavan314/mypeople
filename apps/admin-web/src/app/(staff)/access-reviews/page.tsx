import type { DueAccessReviews, DueGrant } from '@my-people/api-client';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { reviewGrant } from '@/features/organization/reviewActions';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage, type Locale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

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
  const staff = await requireStaff();
  const query = await searchParams;
  const locale = await getAdminLocale(staff.member.language);
  let due: DueAccessReviews;
  try {
    due = await (await staffApi()).listDueAccessReviews();
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  // The quarter ends at midnight starting the next one; the last day to decide is the day before.
  const lastDay = new Date(Date.parse(due.quarterEndsAt) - 1).toISOString();
  return (
    <>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <section className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4 text-sm">
        <p className="font-semibold text-text">
          {due.quarter} · {locale === 'ta' ? 'முடிவு செய்ய வேண்டிய இறுதித் திகதி:' : 'decide by'} {formatDate(lastDay)}
        </p>
        <p className="text-muted">
          {locale === 'ta'
            ? `இக்காலாண்டில் மீளாய்வு செய்யப்பட்டவை: ${due.reviewedThisQuarter} / ${due.reviewedThisQuarter + due.items.length}`
            : `Reviewed this quarter: ${due.reviewedThisQuarter} of ${due.reviewedThisQuarter + due.items.length}`}
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'உங்கள் மீளாய்வுக்காகக் காத்திருப்பவை' : 'Waiting for your review'}</span>
        </h2>
        {due.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 text-center text-muted">
            <p lang={locale} className="text-sm font-semibold text-text">
              {locale === 'ta' ? 'மீளாய்வுக்காக எதுவும் நிலுவையில் இல்லை' : 'No reviews pending this quarter'}
            </p>
            <p className="mt-1 text-xs">
              {locale === 'ta'
                ? 'உங்கள் அதிகார எல்லைக்குட்பட்ட அனைத்து பணியாளர் பொறுப்புகளும் இக்காலாண்டிற்கு மீளாய்வு செய்யப்பட்டுவிட்டன.'
                : 'All staff roles in your assigned areas have been reviewed for this quarter.'}
            </p>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {due.items.map((grant) => (
            <DueRole key={grant.id} grant={grant} locale={locale} />
          ))}
        </ul>
      </section>
    </>
  );
}

function DueRole({ grant, locale }: { grant: DueGrant; locale: Locale }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-sm">
      <p className="font-semibold text-text">
        {grant.fullName} <span className="font-mono text-muted">{grant.memberCode}</span>
      </p>
      <p className="text-muted">
        Tier {grant.tier} · {areaText(grant.area)} · {locale === 'ta' ? 'வழங்கப்பட்டது:' : 'granted'} {formatDate(grant.grantedAt)} · {locale === 'ta' ? 'கடைசி மீளாய்வு:' : 'last reviewed'}{' '}
        {grant.lastReviewedAt ? formatDate(grant.lastReviewedAt) : (locale === 'ta' ? 'இதுவரை இல்லை' : 'never')}
      </p>
      <p className="flex flex-wrap items-center gap-2">
        {grant.overdue ? <StateTag state="suspended" /> : null}
        <span className="text-xs">
          {grant.overdue
            ? locale === 'ta'
              ? `${formatDate(grant.reviewDueAt)} முதல் காலாவதியானது: மீள உறுதிசெய்யும் வரை இயங்காது`
              : `Overdue since ${formatDate(grant.reviewDueAt)}: suspended until confirmed`
            : `${locale === 'ta' ? 'மீளாய்வுத் திகதி:' : 'Due'} ${formatDate(grant.reviewDueAt)}`}
        </span>
      </p>
      <p className="font-mono text-xs text-muted">{grant.permissions.join(', ')}</p>
      <form action={reviewGrant} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="assignmentId" value={grant.id} />
        <label htmlFor={`input-reason-${grant.id}`} className="flex flex-col gap-1 font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta' ? 'காரணம் *' : 'Reason *'}
          </span>
          <input
            id={`input-reason-${grant.id}`}
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
            name="confirmReview"
            value="1"
            required
            className="mt-0.5 rounded border-line"
          />
          <span lang={locale} className="font-semibold text-text">
            {locale === 'ta'
              ? 'இக்காலாண்டு அணுகல் மீளாய்வுத் தீர்மானத்தை உறுதிப்படுத்துகிறேன்.'
              : 'I confirm this quarterly access review decision and its recorded justification.'}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="confirmed">
            <span lang={locale}>
              {locale === 'ta' ? 'அடுத்த காலாண்டிற்கு உறுதிப்படுத்துக' : 'Confirm for another quarter'}
            </span>
          </SubmitButton>
          <SubmitButton tone="danger" name="decision" value="revoked">
            <span lang={locale}>
              {locale === 'ta' ? 'பொறுப்பை முடிவுக்குக் கொண்டுவருக' : 'Revoke role'}
            </span>
          </SubmitButton>
        </div>
      </form>
    </li>
  );
}
