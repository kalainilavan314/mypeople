import type { ReviewFile } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { claimOrRelease, decide, reportDuplicate } from '@/features/verification/actions';
import { areaText, formatDate, formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
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
  let review: ReviewFile;
  try {
    review = await (await staffApi()).getIdentityReview(id);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  const claimedByMe = review.claimedBy === staff.member.id;
  const open = OPEN.has(review.state);

  return (
    <>
      <PageHeader ta="அடையாள முடிவு" en={`Review ${review.reviewRef}`}>
        <Link href="/verification" className="text-sm text-primary underline">
          <span lang="ta">சரிபார்ப்புப் பணிவரிசைக்குத் திரும்புக</span> · Back to queue
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />

      <section className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2" aria-label="Member">
        <Fact ta="உறுப்பினர்" en="Member">{review.member.fullName}</Fact>
        <Fact ta="உறுப்பினர் அடையாளக் குறியீடு" en="Member ID">
          <span className="font-mono">{review.member.memberCode}</span>
        </Fact>
        <Fact ta="பிறந்த திகதி" en="Date of birth">{formatDate(review.member.dob)}</Fact>
        <Fact ta="சரிபார்ப்பு வழி" en="Route">{review.route.toUpperCase()}</Fact>
        <Fact ta="பகுதி" en="Area">{areaText(review.area)}</Fact>
        <Fact ta="நிலை" en="State">
          <StateTag state={review.state} />
        </Fact>
        <Fact ta="சமர்ப்பிக்கப்பட்ட திகதி" en="Submitted">{formatDateTime(review.resubmittedAt ?? review.submittedAt)}</Fact>
        <Fact ta="பொறுப்பேற்றவர்" en="Claimed by">{review.claimedByName ?? 'Nobody'}</Fact>
      </section>

      {open ? (
        <form action={claimOrRelease} className="flex gap-3">
          <input type="hidden" name="reviewId" value={review.id} />
          {claimedByMe ? (
            <SubmitButton tone="secondary" name="do" value="release">
              <span className="flex flex-col items-center">
                <span lang="ta">விடுவிக்க</span>
                <span lang="en" className="text-xs font-normal opacity-90">Release the review</span>
              </span>
            </SubmitButton>
          ) : (
            <SubmitButton name="do" value="claim">
              <span className="flex flex-col items-center">
                <span lang="ta">பொறுப்பேற்க</span>
                <span lang="en" className="text-xs font-normal opacity-90">Claim the review</span>
              </span>
            </SubmitButton>
          )}
        </form>
      ) : null}

      <section aria-labelledby="images" className="flex flex-col gap-2">
        <div>
          <p lang="ta" className="text-xs font-semibold text-muted">அடையாள ஆவணப் படங்கள்</p>
          <h2 id="images" className="text-base font-bold">Identity images</h2>
        </div>
        <p className="text-sm text-muted">
          <span lang="ta" className="block text-text">
            ஒவ்வொரு படமும் 5 நிமிடங்களில் காலாவதியாகும் உங்களுக்கான பிரத்தியேக இணைப்பின் மூலம் புதிய தாவலில் திறக்கப்படும்; ஒவ்வொரு திறப்பும் பதிவுசெய்யப்படும்.
          </span>
          <span lang="en" className="mt-0.5 block">
            Each image opens in a new tab through a link for you alone that expires after 5 minutes; every opening is recorded and the member sees when (not who). Images open only while you hold this review.
          </span>
        </p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {review.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-semibold">{words(document.kind)}</span>
                <span className="block text-xs text-muted">
                  Version {document.version} · {Math.round(document.byteSize / 1024)} KB · received {formatDateTime(document.serverAckAt)}
                </span>
              </span>
              {claimedByMe ? (
                <a href={`/evidence/${document.id}`} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-primary">
                  <span lang="ta">படத்தைத் திறக்க</span> · Open image
                </a>
              ) : (
                <span className="text-xs text-muted">
                  <span lang="ta">திறக்கப் பொறுப்பேற்கவும்</span> · Claim to open
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="screening" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
        <div>
          <p lang="ta" className="text-xs font-semibold text-muted">
            தானியங்கி சரிபார்ப்பு வழிகாட்டல்
          </p>
          <h2 id="screening" className="text-base font-bold">
            Automated screening & advisory assistance
          </h2>
        </div>
        <p className="text-muted">
          Automated checks (optical recognition, quality metrics, and document consistency) provide advisory assistance only and have intrinsic confidence limitations.
        </p>
        <div className="rounded-lg border border-line bg-card p-3 text-xs text-text">
          <p className="font-semibold text-primary">Human reviewer mandate</p>
          <p className="mt-0.5 text-muted">
            All verification decisions are strictly made by authorized human staff. Automated screening never approves or rejects identity submissions. When automated signals are pending or inconclusive, evaluate the original document evidence directly.
          </p>
        </div>
      </section>

      {review.duplicateFlags.length > 0 ? (
        <section aria-labelledby="flags" className="rounded-xl border border-error bg-error-bg p-4 text-sm text-error">
          <h2 id="flags" className="font-bold">
            ! Possible duplicate account
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

      {open && claimedByMe ? <DecisionForm review={review} query={query} /> : null}
      {open && claimedByMe ? <DuplicateReport review={review} /> : null}

      <section aria-labelledby="history" className="flex flex-col gap-2">
        <div>
          <p lang="ta" className="text-xs font-semibold text-muted">முந்தைய முடிவுகள்</p>
          <h2 id="history" className="text-base font-bold">Decisions</h2>
        </div>
        {review.decisions.length === 0 ? (
          <p className="text-sm text-muted">
            <span lang="ta">இன்னும் முடிவுகள் எதுவும் எடுக்கப்படவில்லை.</span> · None yet.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {review.decisions.map((decision) => (
            <li key={decision.id} className="rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold">
                {words(decision.decision)} · Tier {decision.reviewerTier} · {formatDateTime(decision.decidedAt)}
              </p>
              {decision.requestedItems.length > 0 ? <p>Items: {decision.requestedItems.map(words).join(', ')}</p> : null}
              {decision.reasonCategory ? <p>Reason: {words(decision.reasonCategory)}</p> : null}
              {decision.note ? <p className="text-muted">{decision.note}</p> : null}
              {decision.appeal ? <p>Appeal {decision.appeal.appealRef}: {words(decision.appeal.state)}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Fact({ ta, en, children }: { ta: string; en: string; children: ReactNode }) {
  return (
    <div>
      <span lang="ta" className="block text-xs font-semibold text-muted">{ta}</span>
      <span lang="en" className="block text-xs text-muted">{en}</span>
      <div className="mt-1 font-semibold text-text">{children}</div>
    </div>
  );
}

function DecisionForm({ review, query }: { review: ReviewFile; query: Record<string, string | string[] | undefined> }) {
  const problems = (one(query.problems) ?? '').split(',');
  const hasProblem = (p: string) => problems.includes(p);
  return (
    <form action={decide} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
      <input type="hidden" name="reviewId" value={review.id} />
      <div>
        <p lang="ta" className="text-xs font-semibold text-primary">அடையாளச் சரிபார்ப்பு முடிவு</p>
        <h2 className="text-base font-bold">Final Review Decision</h2>
      </div>

      <fieldset id="input-checklist" className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">
          <span lang="ta" className="block text-xs text-muted">சரிபார்ப்புப் பட்டியல் (ஒப்புதலுக்கு அனைத்தும் தேவை)</span>
          <span lang="en">Checklist (all needed to approve)</span>
        </legend>
        {CHECKLIST.map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="checklist" value={value} />
            <span>
              <span lang="ta" className="block font-medium">{label.ta}</span>
              <span lang="en" className="block text-xs text-muted">{label.en}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset id="input-decision" className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">
          <span lang="ta" className="block text-xs text-muted">இறுதி முடிவு</span>
          <span lang="en">One final decision</span>
        </legend>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="decision" value="approve" required />
          <span>
            <span lang="ta" className="block font-semibold">ஒப்புதல்: அடையாளம் உறுதிசெய்யப்பட்டது</span>
            <span lang="en" className="block text-xs text-muted">Approve: identity verified</span>
          </span>
        </label>

        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" value="request_update" />
            <span>
              <span lang="ta" className="block font-semibold">திருத்தக் கோரிக்கை</span>
              <span lang="en" className="block text-xs text-muted">Request an update</span>
            </span>
          </label>
          <p className="text-xs text-muted">
            <span lang="ta" className="block">உறுப்பினர் திருத்த வேண்டிய ஒவ்வொரு உருப்படியையும் குறிப்பிடுக:</span>
            <span lang="en">Name each item the member must correct:</span>
          </p>
          <div id="input-items" className="flex flex-wrap gap-3">
            {[...ROUTE_ITEMS[review.route], 'profile_details'].map((item) => (
              <label key={item} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="items" value={item} />
                <span>
                  <span lang="ta" className="block font-medium">{ITEM_LABELS[item]?.ta ?? words(item)}</span>
                  <span lang="en" className="block text-xs text-muted">{ITEM_LABELS[item]?.en ?? words(item)}</span>
                </span>
              </label>
            ))}
          </div>
          <Reason name="reason_request_update" options={REASONS.request_update} />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" value="unable_to_verify" />
            <span>
              <span lang="ta" className="block font-semibold">சரிபார்க்க இயலவில்லை</span>
              <span lang="en" className="block text-xs text-muted">Unable to verify</span>
            </span>
          </label>
          <Reason name="reason_unable_to_verify" options={REASONS.unable_to_verify} />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <span lang="ta" className="text-xs text-muted">உறுப்பினருக்குக் காண்பிக்கப்படும் குறிப்பு</span>
        <span lang="en" className="text-xs">Note to the member (shown to them)</span>
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
        <span>
          <span lang="ta" className="block font-semibold text-text">
            சான்றாவணங்களை நேரடியாகப் பரிசீலித்து அனைத்து விதிமுறைகளும் பூர்த்தியடைந்துள்ளன என்பதை உறுதிப்படுத்துகிறேன்.
          </span>
          <span lang="en" className="block text-muted">
            I confirm that I have inspected the identity documents and verified all checklist items before recording this decision.
          </span>
        </span>
      </label>
      {hasProblem('confirmation_required') ? (
        <p id="field-error-confirm" role="alert" className="text-xs font-semibold text-error">
          <span lang="ta">! முடிவைப் பதிவுசெய்வதற்கு முன் உறுதிப்படுத்தல் பெட்டி தெரிவுசெய்யப்பட வேண்டும்.</span> · Confirmation required.
        </p>
      ) : null}

      <div>
        <SubmitButton>
          <span className="flex flex-col items-center">
            <span lang="ta">முடிவைப் பதிவுசெய்க</span>
            <span lang="en" className="text-xs font-normal opacity-90">Record the decision</span>
          </span>
        </SubmitButton>
      </div>
    </form>
  );
}

function Reason({ name, options }: { name: string; options: readonly string[] }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      <span lang="ta" className="text-xs text-muted">காரணம்</span>
      <span lang="en" className="text-xs">Reason</span>
      <select
        id="input-reason"
        name={name}
        defaultValue=""
        className="min-h-11 rounded-lg border border-line px-2 font-normal">
        <option value="">
          தேர்ந்தெடுக்கவும்… · Choose…
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {REASON_LABELS[option]?.ta ?? words(option)} · {REASON_LABELS[option]?.en ?? words(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function DuplicateReport({ review }: { review: ReviewFile }) {
  return (
    <details className="rounded-xl border border-line bg-card p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">
        <span lang="ta" className="font-semibold">சந்தேகத்திற்கிடமான இரட்டைக் கணக்கைப் புகாரளிக்கவும்</span> · Report a suspected duplicate account
      </summary>
      <form action={reportDuplicate} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="reviewId" value={review.id} />
        <input type="hidden" name="memberId" value={review.memberId} />
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">மற்றொரு கணக்கின் உறுப்பினர் அடையாளக் குறியீடு</span>
          <span lang="en" className="text-xs">The other account’s member ID</span>
          <input
            id="input-code"
            name="otherCode"
            required
            className="min-h-11 rounded-lg border border-line px-3 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">இருவரும் ஒரே நபர் என்று நீங்கள் கருதுவதற்கான காரணம்</span>
          <span lang="en" className="text-xs">Why you think they are the same person</span>
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
          <span className="flex flex-col items-center">
            <span lang="ta">விசாரணையைத் தொடங்குக</span>
            <span lang="en" className="text-xs font-normal opacity-90">Open an investigation</span>
          </span>
        </SubmitButton>
      </form>
    </details>
  );
}
