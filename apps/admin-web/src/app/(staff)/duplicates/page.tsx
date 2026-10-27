import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

/** D04: open duplicate-account investigations over both accounts' areas, oldest first. */
export default function DuplicatesPage() {
  return (
    <>
      <PageHeader ta="இரட்டைக் கணக்கு விசாரணைகள்" en="Duplicate investigations" brd="D04, FR-IDV-010, PRM-28" />
      <p className="text-sm text-muted">A finding never changes either account by itself (BR-094); the person who reported a case does not investigate it.</p>
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
      empty="No open investigations."
      columns={[
        { header: 'State', cell: (item) => <StateTag state={item.state} /> },
        { header: 'Signal', cell: (item) => words(item.signal) },
        { header: 'Opened', cell: (item) => formatDateTime(item.openedAt) },
        { header: 'Claimed by', cell: (item) => item.claimedByName ?? '—' },
      ]}
    />
  );
}
