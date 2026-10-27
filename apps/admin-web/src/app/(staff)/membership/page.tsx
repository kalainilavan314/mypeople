import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { SubmitButton } from '@/components/SubmitButton';
import { findMember } from '@/features/members/actions';
import { areaText, formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

/** D06: verified members still pending in the person's areas, and any member's file by exact ID. */
export default function MembershipPage(props: PageProps<'/membership'>) {
  return (
    <>
      <PageHeader ta="உறுப்புரிமைச் செயற்படுத்தல்" en="Membership activation" brd="D06, FR-ADM-003, PRM-05" />
      <p className="text-sm text-muted">
        A verified identity does not make membership active (BR-014). Every change needs a reason, and a staff member’s
        membership can be changed only by someone ranked above them.
      </p>
      <form action={findMember} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Open a member by exact member ID
          <input name="code" required minLength={3} className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <SubmitButton tone="secondary">Open</SubmitButton>
      </form>
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Awaiting searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Awaiting({ searchParams }: { searchParams: PageProps<'/membership'>['searchParams'] }) {
  const query = await searchParams;
  let members;
  try {
    members = await (await staffApi()).listAwaitingActivation(100);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  return (
    <>
      <Feedback error={query.error} />
      <h2 className="text-base font-bold">Verified and waiting for activation</h2>
      <RecordTable
        caption="Members awaiting activation"
        rows={members}
        rowKey={(member) => member.id}
        href={(member) => `/membership/${member.id}`}
        linkText={(member) => member.memberCode}
        empty="Nobody is waiting in your areas."
        columns={[
          { header: 'Name', cell: (member) => member.fullName },
          { header: 'Area', cell: (member) => areaText(member.area) },
          { header: 'Identity verified', cell: (member) => formatDateTime(member.verifiedAt) },
        ]}
      />
    </>
  );
}
