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

// The API's lists (services/api/app/modules/identity/reviews/rules.py). The reason
// categories are a proposal awaiting sponsor confirmation.
const CHECKLIST = [
  ['pages_present', 'Every page and side is present'],
  ['readable', 'Every image is readable'],
  ['details_match_profile', 'Name and date of birth match the profile'],
  ['selfie_reviewable', 'The selfie shows the same person clearly'],
  ['area_checked', 'The area is plausible for the member'],
] as const;
const REASONS = {
  request_update: ['image_unreadable', 'image_incomplete', 'wrong_document', 'details_do_not_match', 'selfie_unclear', 'other'],
  unable_to_verify: ['document_not_valid', 'person_does_not_match', 'details_do_not_match', 'other'],
} as const;
const ROUTE_ITEMS = { nic: ['nic_front', 'nic_back', 'selfie'], passport: ['passport_page', 'selfie'] } as const;
const OPEN = new Set(['submitted', 'in_review']);

/** W02: the member's details, their images (each opened through a 5-minute link), the checklist and the decision. */
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
      <PageHeader ta="அடையாள முடிவு" en={`Review ${review.reviewRef}`} brd="W02, FR-WEB-005 to 013">
        <Link href="/verification" className="text-sm text-primary underline">
          Back to the queue
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />

      <section className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2" aria-label="Member">
        <Fact label="Member">{review.member.fullName}</Fact>
        <Fact label="Member ID">
          <span className="font-mono">{review.member.memberCode}</span>
        </Fact>
        <Fact label="Date of birth">{formatDate(review.member.dob)}</Fact>
        <Fact label="Route">{review.route.toUpperCase()}</Fact>
        <Fact label="Area">{areaText(review.area)}</Fact>
        <Fact label="State">
          <StateTag state={review.state} />
        </Fact>
        <Fact label="Submitted">{formatDateTime(review.resubmittedAt ?? review.submittedAt)}</Fact>
        <Fact label="Claimed by">{review.claimedByName ?? 'Nobody'}</Fact>
      </section>

      {open ? (
        <form action={claimOrRelease} className="flex gap-3">
          <input type="hidden" name="reviewId" value={review.id} />
          {claimedByMe ? (
            <SubmitButton tone="secondary" name="do" value="release">
              Release the review
            </SubmitButton>
          ) : (
            <SubmitButton name="do" value="claim">
              Claim the review
            </SubmitButton>
          )}
        </form>
      ) : null}

      <section aria-labelledby="images" className="flex flex-col gap-2">
        <h2 id="images" className="text-base font-bold">
          Identity images
        </h2>
        <p className="text-sm text-muted">
          Each image opens in a new tab through a link for you alone that expires after 5 minutes; every opening is
          recorded and the member sees when (not who). Images open only while you hold this review.
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
                  Open image
                </a>
              ) : (
                <span className="text-xs text-muted">Claim to open</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="screening" className="rounded-xl border border-line bg-surface p-4 text-sm">
        <h2 id="screening" className="font-bold">
          Screening (D03)
        </h2>
        <p className="text-muted">
          No screening: quality, OCR and similarity checks wait for the AI worker (OD-42, OD-28). Decide from the images.
        </p>
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

      {open && claimedByMe ? <DecisionForm review={review} /> : null}
      {open && claimedByMe ? <DuplicateReport review={review} /> : null}

      <section aria-labelledby="history" className="flex flex-col gap-2">
        <h2 id="history" className="text-base font-bold">
          Decisions
        </h2>
        {review.decisions.length === 0 ? <p className="text-sm text-muted">None yet.</p> : null}
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="font-semibold">{children}</div>
    </div>
  );
}

function DecisionForm({ review }: { review: ReviewFile }) {
  return (
    <form action={decide} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
      <input type="hidden" name="reviewId" value={review.id} />
      <h2 className="text-base font-bold">Decision</h2>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Checklist (all needed to approve)</legend>
        {CHECKLIST.map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="checklist" value={value} /> {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Exactly one decision (FR-WEB-008)</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="decision" value="approve" required /> Approve: identity verified
        </label>
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" value="request_update" /> Request an update
          </label>
          <p className="text-xs text-muted">Name each item the member must correct:</p>
          <div className="flex flex-wrap gap-3">
            {[...ROUTE_ITEMS[review.route], 'profile_details'].map((item) => (
              <label key={item} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="items" value={item} /> {words(item)}
              </label>
            ))}
          </div>
          <Reason name="reason_request_update" options={REASONS.request_update} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" value="unable_to_verify" /> Unable to verify
          </label>
          <Reason name="reason_unable_to_verify" options={REASONS.unable_to_verify} />
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Note to the member (shown to them)
        <textarea name="note" maxLength={500} rows={3} className="rounded-lg border border-line p-2 text-base font-normal" />
      </label>
      <SubmitButton>Record the decision</SubmitButton>
    </form>
  );
}

function Reason({ name, options }: { name: string; options: readonly string[] }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      Reason
      <select name={name} defaultValue="" className="min-h-11 rounded-lg border border-line px-2 font-normal">
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {words(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function DuplicateReport({ review }: { review: ReviewFile }) {
  return (
    <details className="rounded-xl border border-line bg-card p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">Report a suspected duplicate account (FR-WEB-012)</summary>
      <form action={reportDuplicate} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="reviewId" value={review.id} />
        <input type="hidden" name="memberId" value={review.memberId} />
        <label className="flex flex-col gap-1 text-sm font-semibold">
          The other account’s member ID
          <input name="otherCode" required className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Why you think they are the same person
          <textarea name="reason" required minLength={3} maxLength={500} rows={2} className="rounded-lg border border-line p-2 text-base font-normal" />
        </label>
        <SubmitButton tone="secondary">Open an investigation</SubmitButton>
      </form>
    </details>
  );
}
