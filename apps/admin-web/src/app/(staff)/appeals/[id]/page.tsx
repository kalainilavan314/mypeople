import type { AppealFile } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { CaseControls } from '@/features/verification/CaseControls';
import { formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const OUTCOMES = [
  ['uphold', 'Uphold: the decision stands'],
  ['overturn', 'Overturn: the review opens again for another reviewer'],
] as const;

/** D05: the statement, the decision under appeal and the evidence, decided by a different reviewer. */
export default function AppealPage(props: PageProps<'/appeals/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading the appeal</p>}>
      <Appeal params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Appeal({ params, searchParams }: Pick<PageProps<'/appeals/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const staff = await requireStaff();
  let appeal: AppealFile;
  try {
    appeal = await (await staffApi()).getIdentityAppeal(id);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  const claimedByMe = appeal.claimedBy === staff.member.id;
  const open = appeal.state === 'submitted' || appeal.state === 'in_review';

  return (
    <>
      <PageHeader ta="மேன்முறையீடு" en={`Appeal ${appeal.appealRef}`} brd="D05">
        <Link href="/appeals" className="text-sm text-primary underline">
          Back to appeals
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm">
        <p>
          <StateTag state={appeal.state} /> · review <span className="font-mono">{appeal.reviewRef}</span> · submitted{' '}
          {formatDateTime(appeal.submittedAt)}
        </p>
        <p className="font-semibold">{appeal.member.fullName}</p>
        <p className="font-mono text-muted">{appeal.member.memberCode}</p>
        <h2 className="mt-2 font-bold">The member’s statement</h2>
        <p className="whitespace-pre-wrap">{appeal.statement}</p>
        <h2 className="mt-2 font-bold">The decision under appeal</h2>
        <p>
          {words(appeal.decision.decision)} · Tier {appeal.decision.reviewerTier} · {formatDateTime(appeal.decision.decidedAt)}
        </p>
        {appeal.decision.reasonCategory ? <p>Reason: {words(appeal.decision.reasonCategory)}</p> : null}
        {appeal.decision.note ? <p className="text-muted">{appeal.decision.note}</p> : null}
        {appeal.outcomeReason ? (
          <p className="mt-2">
            Outcome: {words(appeal.state)} · {appeal.outcomeReason}
          </p>
        ) : null}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">Identity images</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {appeal.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-semibold">
                {words(document.kind)} · version {document.version}
              </span>
              {claimedByMe ? (
                <a href={`/evidence/${document.id}`} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg border border-line px-3 py-2 font-semibold text-primary">
                  Open image
                </a>
              ) : (
                <span className="text-xs text-muted">Claim to open</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <CaseControls kind="appeals" id={appeal.id} open={open} claimedByMe={claimedByMe} outcomes={OUTCOMES} />
    </>
  );
}
