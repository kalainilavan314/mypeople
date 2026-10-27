import type { DuplicateCaseFile } from '@my-people/api-client';
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
  ['not_duplicate', 'Not a duplicate: two different people'],
  ['duplicate_confirmed', 'Duplicate confirmed: one person, two accounts'],
] as const;

/** D04: both accounts side by side with their history, decided with a reason (FR-WEB-012). */
export default function DuplicateCasePage(props: PageProps<'/duplicates/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading the case</p>}>
      <DuplicateCase params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DuplicateCase({ params, searchParams }: Pick<PageProps<'/duplicates/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const staff = await requireStaff();
  let file: DuplicateCaseFile;
  try {
    file = await (await staffApi()).getDuplicateCase(id);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  const claimedByMe = file.claimedBy === staff.member.id;
  const open = file.state === 'open' || file.state === 'in_review';

  return (
    <>
      <PageHeader ta="இரட்டைக் கணக்கு" en={`Case ${file.caseRef}`} brd="D04">
        <Link href="/duplicates" className="text-sm text-primary underline">
          Back to investigations
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <p className="text-sm">
        <StateTag state={file.state} /> · {words(file.signal)} · opened {formatDateTime(file.openedAt)}
        {file.openedReason ? ` · ${file.openedReason}` : ''}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {file.members.map((member) => (
          <section key={member.memberId} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm">
            <h2 className="font-bold">{member.details.fullName}</h2>
            <p className="font-mono text-muted">{member.details.memberCode}</p>
            <p>Date of birth: {member.details.dob ?? '—'}</p>
            <p>
              Identity: {words(member.verificationStatus)} · membership: {words(member.membershipState)}
            </p>
            <ul className="divide-y divide-line">
              {member.documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {words(document.kind)} · version {document.version}
                  </span>
                  {claimedByMe ? (
                    <a href={`/evidence/${document.id}`} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg border border-line px-3 py-2 font-semibold text-primary">
                      Open image
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {file.outcomeReason ? <p className="text-sm">Finding: {file.outcomeReason}</p> : null}
      <CaseControls kind="duplicates" id={file.id} open={open} claimedByMe={claimedByMe} outcomes={OUTCOMES} />
    </>
  );
}
