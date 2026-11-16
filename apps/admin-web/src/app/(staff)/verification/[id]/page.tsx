import type { ReviewFile } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { claimOrRelease, decide, reportDuplicate } from '@/features/verification/actions';
import { areaText, formatDate, formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage, getLocalizedProblem, type Locale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const CHECKLIST = [
  ['pages_present', { ta: 'அனைத்துப் பக்கங்களும் பக்கவாட்டுகளும் கிடைக்கின்றன', en: 'Every page and side is present' }],
  ['readable', { ta: 'அனைத்துப் படங்களும் தெளிவாக வாசிக்கக்கூடியவை', en: 'Every image is readable' }],
  ['details_match_profile', { ta: 'பெயரும் பிறந்த திகதியும் சுயவிவரத்துடன் பொருந்துகின்றன', en: 'Name and date of birth match the profile' }],
  ['selfie_reviewable', { ta: 'சுயபடம் அதே நபரைத் தெளிவாகக் காட்டுகிறது', en: 'The selfie shows the same person clearly' }],
  ['area_checked', { ta: 'பகுதி உறுப்பினருக்குப் பொருத்தமானது', en: 'The area is plausible for the member' }],
] as const;

const REASONS = {
  request_update: ['image_unreadable', 'image_incomplete', 'wrong_document', 'details_do_not_match', 'selfie_unclear', 'other'],
  unable_to_verify: ['document_not_valid', 'person_does_not_match', 'details_do_not_match', 'other'],
} as const;

const REASON_LABELS: Record<string, { ta: string; en: string }> = {
  image_unreadable: { ta: 'படம் வாசிக்க முடியாதது', en: 'Image unreadable' },
  image_incomplete: { ta: 'படம் முழுமையற்றது', en: 'Image incomplete' },
  wrong_document: { ta: 'தவறான ஆவணம்', en: 'Wrong document' },
  details_do_not_match: { ta: 'விவரங்கள் பொருந்தவில்லை', en: 'Details do not match' },
  selfie_unclear: { ta: 'சுயபடம் தெளிவாக இல்லை', en: 'Selfie unclear' },
  document_not_valid: { ta: 'ஆவணம் செல்லுபடியற்றது', en: 'Document not valid' },
  person_does_not_match: { ta: 'நபர் பொருந்தவில்லை', en: 'Person does not match' },
  other: { ta: 'மற்றவை', en: 'Other' },
};

const ITEM_LABELS: Record<string, { ta: string; en: string }> = {
  nic_front: { ta: 'தே.அ.அட்டை முன்பக்கம்', en: 'NIC front' },
  nic_back: { ta: 'தே.அ.அட்டை பின்பக்கம்', en: 'NIC back' },
  passport_page: { ta: 'கடவுச்சீட்டு பக்கம்', en: 'Passport page' },
  selfie: { ta: 'சுயபடம்', en: 'Selfie' },
  profile_details: { ta: 'சுயவிவர விவரங்கள்', en: 'Profile details' },
};

const ROUTE_ITEMS = { nic: ['nic_front', 'nic_back', 'selfie'], passport: ['passport_page', 'selfie'] } as const;
const OPEN = new Set(['submitted', 'in_review']);

/** Identity verification console: review member images, automated advisory signals, checklist, and decision. */
export default function ReviewPage(props: PageProps<'/verification/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading the review</p>}>
      <Review params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Review({ params, searchParams }: Pick<PageProps<'/verification/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let review: ReviewFile;
  try {
    review = await (await staffApi()).getIdentityReview(id);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  const claimedByMe = review.claimedBy === staff.member.id;
  const open = OPEN.has(review.state);

  return (
    <>
      <PageHeader ta="அடையாள முடிவு" en={`Review ${review.reviewRef}`}>
        <Link href="/verification" className="text-sm text-primary underline">
          <span lang={locale}>
            {locale === 'ta' ? 'சரிபார்ப்புப் பணிவரிசைக்குத் திரும்புக' : 'Back to queue'}
          </span>
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />

      <section className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2" aria-label="Member">
        <Fact label={locale === 'ta' ? 'உறுப்பினர்' : 'Member'} locale={locale}>{review.member.fullName}</Fact>
        <Fact label={locale === 'ta' ? 'உறுப்பினர் அடையாளக் குறியீடு' : 'Member ID'} locale={locale}>
          <span className="font-mono">{review.member.memberCode}</span>
        </Fact>
        <Fact label={locale === 'ta' ? 'பிறந்த திகதி' : 'Date of birth'} locale={locale}>{formatDate(review.member.dob)}</Fact>
        <Fact label={locale === 'ta' ? 'சரிபார்ப்பு வழி' : 'Route'} locale={locale}>{review.route.toUpperCase()}</Fact>
        <Fact label={locale === 'ta' ? 'பகுதி' : 'Area'} locale={locale}>{areaText(review.area)}</Fact>
        <Fact label={locale === 'ta' ? 'நிலை' : 'State'} locale={locale}>
          <StateTag state={review.state} />
        </Fact>
        <Fact label={locale === 'ta' ? 'சமர்ப்பிக்கப்பட்ட திகதி' : 'Submitted'} locale={locale}>{formatDateTime(review.resubmittedAt ?? review.submittedAt)}</Fact>
        <Fact label={locale === 'ta' ? 'பொறுப்பேற்றவர்' : 'Claimed by'} locale={locale}>{review.claimedByName ?? (locale === 'ta' ? 'யாரும் இல்லை' : 'Nobody')}</Fact>
      </section>

      {open ? (
        <form action={claimOrRelease} className="flex gap-3">
          <input type="hidden" name="reviewId" value={review.id} />
          {claimedByMe ? (
            <SubmitButton tone="secondary" name="do" value="release">
              <span lang={locale}>{locale === 'ta' ? 'விடுவிக்க' : 'Release review'}</span>
            </SubmitButton>
          ) : (
            <SubmitButton name="do" value="claim">
              <span lang={locale}>{locale === 'ta' ? 'பொறுப்பேற்க' : 'Claim review'}</span>
            </SubmitButton>
          )}
        </form>
      ) : null}

      <section aria-labelledby="images" className="flex flex-col gap-2">
        <div>
          <h2 id="images" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? 'அடையாள ஆவணப் படங்கள்' : 'Identity images'}</span>
          </h2>
        </div>
        <p className="text-sm text-muted">
          <span lang={locale}>
            {locale === 'ta'
              ? 'ஒவ்வொரு படமும் 5 நிமிடங்களில் காலாவதியாகும் உங்களுக்கான பிரத்தியேக இணைப்பின் மூலம் புதிய தாவலில் திறக்கப்படும்; ஒவ்வொரு திறப்பும் பதிவுசெய்யப்படும்.'
              : 'Each image opens in a new tab through a link for you alone that expires after 5 minutes; every opening is recorded and the member sees when (not who). Images open only while you hold this review.'}
          </span>
        </p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {review.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-semibold text-text">{words(document.kind)}</span>
                <span className="block text-xs text-muted">
                  Version {document.version} · {Math.round(document.byteSize / 1024)} KB · {locale === 'ta' ? 'பெறப்பட்டது' : 'received'} {formatDateTime(document.serverAckAt)}
                </span>
              </span>
              {claimedByMe ? (
                <a href={`/evidence/${document.id}`} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-primary">
                  <span lang={locale}>{locale === 'ta' ? 'படத்தைத் திறக்க' : 'Open image'}</span>
                </a>
              ) : (
                <span className="text-xs text-muted">
                  <span lang={locale}>{locale === 'ta' ? 'திறக்கப் பொறுப்பேற்கவும்' : 'Claim to open'}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="screening" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
        <div>
          <h2 id="screening" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? 'தானியங்கி சரிபார்ப்பு வழிகாட்டல்' : 'Automated screening & advisory assistance'}</span>
          </h2>
        </div>
        <p className="text-muted">
          {locale === 'ta'
            ? 'தானியங்கி சோதனைகள் மதிப்பீட்டாளருக்கு ஆலோசனை வழங்குவதற்காக மட்டுமே. அவை தானாக ஒப்புதல் அளிக்கவோ நிராகரிக்கவோ செய்யாது.'
            : 'Automated checks provide advisory assistance only and have intrinsic confidence limitations.'}
        </p>
        <div className="rounded-lg border border-line bg-card p-3 text-xs text-text">
          <p className="font-semibold text-primary">
            {locale === 'ta' ? 'மனித மதிப்பீட்டாளரின் இறுதி முடிவு' : 'Human reviewer mandate'}
          </p>
          <p className="mt-0.5 text-muted">
            {locale === 'ta'
              ? 'அனைத்து சரிபார்ப்பு முடிவுகளும் மனித பணியாளர்களால் மட்டுமே எடுக்கப்படுகின்றன. தானியங்கி சமிக்கைகள் தெளிவாக இல்லாதபோது அசல் ஆவணங்களை நேரடியாக ஆய்வு செய்யவும்.'
              : 'All verification decisions are strictly made by authorized human staff. Automated screening never approves or rejects identity submissions.'}
          </p>
        </div>
      </section>

      {review.duplicateFlags.length > 0 ? (
        <section aria-labelledby="flags" className="rounded-xl border border-error bg-error-bg p-4 text-sm text-error">
          <h2 id="flags" className="font-bold">
            ! {locale === 'ta' ? 'சாத்தியமான இரட்டைக் கணக்கு எச்சரிக்கை' : 'Possible duplicate account'}
          </h2>
          <ul className="list-disc pl-5">
            {review.duplicateFlags.map((flag) => (
              <li key={flag.caseRef}>
                {flag.caseRef}: {words(flag.signal)}, {words(flag.state)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open && claimedByMe ? <DecisionForm review={review} query={query} locale={locale} /> : null}
      {open && claimedByMe ? <DuplicateReport review={review} locale={locale} /> : null}

      <section aria-labelledby="history" className="flex flex-col gap-2">
        <div>
          <h2 id="history" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? 'முந்தைய முடிவுகள்' : 'Decisions'}</span>
          </h2>
        </div>
        {review.decisions.length === 0 ? (
          <p className="text-sm text-muted">
            <span lang={locale}>{locale === 'ta' ? 'இன்னும் முடிவுகள் எதுவும் எடுக்கப்படவில்லை.' : 'None yet.'}</span>
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {review.decisions.map((decision) => (
            <li key={decision.id} className="rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold text-text">
                {words(decision.decision)} · Tier {decision.reviewerTier} · {formatDateTime(decision.decidedAt)}
              </p>
              {decision.requestedItems.length > 0 ? <p>{locale === 'ta' ? 'உருப்படிகள்:' : 'Items:'} {decision.requestedItems.map(words).join(', ')}</p> : null}
              {decision.reasonCategory ? <p>{locale === 'ta' ? 'காரணம்:' : 'Reason:'} {words(decision.reasonCategory)}</p> : null}
              {decision.note ? <p className="text-muted">{decision.note}</p> : null}
              {decision.appeal ? <p>Appeal {decision.appeal.appealRef}: {words(decision.appeal.state)}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Fact({ label, locale, children }: { label: string; locale: Locale; children: ReactNode }) {
  return (
    <div>
      <span lang={locale} className="block text-xs font-semibold text-muted">{label}</span>
      <div className="mt-1 font-semibold text-text">{children}</div>
    </div>
  );
}

function DecisionForm({
  review,
  query,
  locale,
}: {
  review: ReviewFile;
  query: Record<string, string | string[] | undefined>;
  locale: Locale;
}) {
  const problems = (one(query.problems) ?? '').split(',');
  const hasProblem = (p: string) => problems.includes(p);
  return (
    <form action={decide} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
      <input type="hidden" name="reviewId" value={review.id} />
      <div>
        <h2 className="text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'அடையாளச் சரிபார்ப்பு இறுதி முடிவு' : 'Final Review Decision'}</span>
        </h2>
      </div>

      <fieldset id="input-checklist" className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold text-text">
          <span lang={locale}>
            {locale === 'ta' ? 'சரிபார்ப்புப் பட்டியல் (ஒப்புதலுக்கு அனைத்தும் தேவை)' : 'Checklist (all needed to approve)'}
          </span>
        </legend>
        {CHECKLIST.map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="checklist" value={value} />
            <span lang={locale} className="font-medium text-text">
              {label[locale]}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset id="input-decision" className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'இறுதி முடிவு' : 'One final decision'}</span>
        </legend>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="decision" value="approve" required />
          <span lang={locale} className="font-semibold text-text">
            {locale === 'ta' ? 'ஒப்புதல்: அடையாளம் உறுதிசெய்யப்பட்டது' : 'Approve: identity verified'}
          </span>
        </label>

        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" value="request_update" />
            <span lang={locale} className="font-semibold text-text">
              {locale === 'ta' ? 'திருத்தக் கோரிக்கை' : 'Request an update'}
            </span>
          </label>
          <p className="text-xs text-muted">
            <span lang={locale}>
              {locale === 'ta' ? 'உறுப்பினர் திருத்த வேண்டிய ஒவ்வொரு உருப்படியையும் குறிப்பிடுக:' : 'Name each item the member must correct:'}
            </span>
          </p>
          <div id="input-items" className="flex flex-wrap gap-3">
            {[...ROUTE_ITEMS[review.route], 'profile_details'].map((item) => (
              <label key={item} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="items" value={item} />
                <span lang={locale} className="font-medium text-text">
                  {ITEM_LABELS[item]?.[locale] ?? words(item)}
                </span>
              </label>
            ))}
          </div>
          <Reason name="reason_request_update" options={REASONS.request_update} locale={locale} />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" value="unable_to_verify" />
            <span lang={locale} className="font-semibold text-text">
              {locale === 'ta' ? 'சரிபார்க்க இயலவில்லை' : 'Unable to verify'}
            </span>
          </label>
          <Reason name="reason_unable_to_verify" options={REASONS.unable_to_verify} locale={locale} />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-semibold text-text">
        <span lang={locale} className="text-xs">
          {locale === 'ta' ? 'உறுப்பினருக்குக் காண்பிக்கப்படும் குறிப்பு' : 'Note to the member (shown to them)'}
        </span>
        <textarea
          id="input-note"
          name="note"
          maxLength={500}
          rows={3}
          className="rounded-lg border border-line p-2 text-base font-normal"
        />
      </label>

      <label className="flex items-start gap-2 text-xs font-medium text-muted">
        <input
          type="checkbox"
          id="input-confirm"
          name="confirmInspection"
          value="1"
          required
          aria-invalid={hasProblem('confirmation_required') ? 'true' : undefined}
          aria-describedby={hasProblem('confirmation_required') ? 'field-error-confirm' : undefined}
          className="mt-0.5 rounded border-line"
        />
        <span lang={locale} className="font-semibold text-text">
          {locale === 'ta'
            ? 'சான்றாவணங்களை நேரடியாகப் பரிசீலித்து அனைத்து விதிமுறைகளும் பூர்த்தியடைந்துள்ளன என்பதை உறுதிப்படுத்துகிறேன்.'
            : 'I confirm that I have inspected the identity documents and verified all checklist items before recording this decision.'}
        </span>
      </label>
      {hasProblem('confirmation_required') ? (
        <p id="field-error-confirm" role="alert" className="text-xs font-semibold text-error">
          ! {getLocalizedProblem('confirmation_required', locale)}
        </p>
      ) : null}

      <div>
        <SubmitButton>
          <span lang={locale}>{locale === 'ta' ? 'முடிவைப் பதிவுசெய்க' : 'Record the decision'}</span>
        </SubmitButton>
      </div>
    </form>
  );
}

function Reason({ name, options, locale }: { name: string; options: readonly string[]; locale: Locale }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-text">
      <span lang={locale} className="text-xs">
        {locale === 'ta' ? 'காரணம்' : 'Reason'}
      </span>
      <select
        id="input-reason"
        name={name}
        defaultValue=""
        className="min-h-11 rounded-lg border border-line px-2 font-normal">
        <option value="">{locale === 'ta' ? 'தேர்ந்தெடுக்கவும்…' : 'Choose…'}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {REASON_LABELS[option]?.[locale] ?? words(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function DuplicateReport({ review, locale }: { review: ReviewFile; locale: Locale }) {
  return (
    <details className="rounded-xl border border-line bg-card p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold text-text">
        <span lang={locale}>
          {locale === 'ta' ? 'சந்தேகத்திற்கிடமான இரட்டைக் கணக்கைப் புகாரளிக்கவும்' : 'Report a suspected duplicate account'}
        </span>
      </summary>
      <form action={reportDuplicate} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="reviewId" value={review.id} />
        <input type="hidden" name="memberId" value={review.memberId} />
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta' ? 'மற்றொரு கணக்கின் உறுப்பினர் அடையாளக் குறியீடு *' : 'The other account’s member ID *'}
          </span>
          <input
            id="input-code"
            name="otherCode"
            required
            className="min-h-11 rounded-lg border border-line px-3 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta' ? 'இருவரும் ஒரே நபர் என்று நீங்கள் கருதுவதற்கான காரணம் *' : 'Why you think they are the same person *'}
          </span>
          <textarea
            id="input-reason-dup"
            name="reason"
            required
            minLength={3}
            maxLength={500}
            rows={2}
            className="rounded-lg border border-line p-2 text-base font-normal"
          />
        </label>
        <SubmitButton tone="secondary">
          <span lang={locale}>{locale === 'ta' ? 'விசாரணையைத் தொடங்குக' : 'Open an investigation'}</span>
        </SubmitButton>
      </form>
    </details>
  );
}
