import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

/** Open duplicate-account investigations over both accounts' areas, oldest first. */
export default function DuplicatesPage() {
  return (
    <>
      <PageHeader ta="இரட்டைக் கணக்கு விசாரணைகள்" en="Duplicate investigations" />
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang="ta" className="text-xs text-muted">
          விசாரணை முடிவுகள் கணக்குகளைத் தானாக மாற்றாது; முறைப்பாட்டாளர் வழக்கை விசாரிக்க முடியாது.
        </p>
        <p className="text-muted">
          An investigation finding documents whether accounts belong to the same person. Separate operational decisions are required for each account; the person who reported a case cannot investigate it.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Cases />
      </Suspense>
    </>
  );
}

async function Cases() {
  let cases;
  try {
    cases = await (await staffApi()).listDuplicateCases({ limit: 100 });
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  return (
    <RecordTable
      caption="Open investigations"
      rows={cases}
      rowKey={(item) => item.id}
      href={(item) => `/duplicates/${item.id}`}
      linkText={(item) => item.caseRef}
      empty={
        <div className="flex flex-col items-center justify-center text-center text-muted">
          <p lang="ta" className="text-sm font-semibold">
            விசாரணைகள் எதுவும் நிலுவையில் இல்லை
          </p>
          <p className="text-xs">No open duplicate investigations in your assigned areas.</p>
        </div>
      }
      columns={[
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">நிலை</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">State</span>
            </>
          ),
          cell: (item) => <StateTag state={item.state} />,
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">சமிக்ஞை</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Signal</span>
            </>
          ),
          cell: (item) => words(item.signal),
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">தொடங்கப்பட்டது</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Opened</span>
            </>
          ),
          cell: (item) => formatDateTime(item.openedAt),
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">பொறுப்பேற்றவர்</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Claimed by</span>
            </>
          ),
          cell: (item) => item.claimedByName ?? '—',
        },
      ]}
    />
  );
}
