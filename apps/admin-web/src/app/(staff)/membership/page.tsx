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

/** Verified members still pending in the person's areas, and any member's file by exact ID. */
export default function MembershipPage(props: PageProps<'/membership'>) {
  return (
    <>
      <PageHeader ta="உறுப்புரிமைச் செயற்படுத்தல்" en="Membership activation" />
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang="ta" className="text-xs text-muted">
          அடையாளச் சரிபார்ப்புடன் உறுப்புரிமை தானாகச் செயல்படாது; மாற்றங்களுக்குக் காரணம் அவசியமாகும்.
        </p>
        <p className="text-muted">
          A verified identity does not automatically activate membership. Every status change requires an explicit reason, and a staff member’s membership status may only be altered by an authorized reviewer ranked above them.
        </p>
      </div>
      <form action={findMember} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span lang="ta" className="text-xs text-muted">உறுப்பினர் இலக்கத்தை உள்ளிடவும்</span>
          <span lang="en" className="text-xs">Open a member by exact member ID</span>
          <input name="code" required minLength={3} className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <SubmitButton tone="secondary">
          <span className="flex flex-col items-center">
            <span lang="ta">திறக்குக</span>
            <span lang="en" className="text-xs font-normal opacity-90">Open</span>
          </span>
        </SubmitButton>
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
      <h2 className="flex flex-col text-base font-bold">
        <span lang="ta">சரிபார்க்கப்பட்டுச் செயற்படுத்தலுக்காகக் காத்திருப்பவர்கள்</span>
        <span lang="en" className="text-xs font-normal text-muted">Verified and waiting for activation</span>
      </h2>
      <RecordTable
        caption="Members awaiting activation"
        rows={members}
        rowKey={(member) => member.id}
        href={(member) => `/membership/${member.id}`}
        linkText={(member) => member.memberCode}
        empty={
          <div className="flex flex-col items-center justify-center text-center text-muted">
            <p lang="ta" className="text-sm font-semibold">
              செயற்படுத்தலுக்காக யாரும் காத்திருக்கவில்லை
            </p>
            <p className="text-xs">Nobody is waiting for membership activation in your areas.</p>
          </div>
        }
        columns={[
          {
            header: (
              <>
                <span lang="ta" className="block text-text font-semibold">பெயர்</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Name</span>
              </>
            ),
            cell: (member) => member.fullName,
          },
          {
            header: (
              <>
                <span lang="ta" className="block text-text font-semibold">பகுதி</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Area</span>
              </>
            ),
            cell: (member) => areaText(member.area),
          },
          {
            header: (
              <>
                <span lang="ta" className="block text-text font-semibold">அடையாளம் சரிபார்க்கப்பட்டது</span>
                <span lang="en" className="block text-[11px] text-muted font-normal">Identity verified</span>
              </>
            ),
            cell: (member) => formatDateTime(member.verifiedAt),
          },
        ]}
      />
    </>
  );
}
