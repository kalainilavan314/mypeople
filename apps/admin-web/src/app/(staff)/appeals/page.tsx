import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

/** D05: open appeals in the person's areas, oldest first. */
export default function AppealsPage() {
  return (
    <>
      <PageHeader ta="சரிபார்ப்பு மேன்முறையீடுகள்" en="Verification appeals" brd="D05, FR-IDV-013, PRM-29" />
      <p className="text-sm text-muted">
        Decided by someone other than the original reviewer. The outcome and reason are final and shown to the member.
      </p>
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Appeals />
      </Suspense>
    </>
  );
}

async function Appeals() {
  let appeals;
  try {
    appeals = await (await staffApi()).listIdentityAppeals({ limit: 100 });
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  return (
    <RecordTable
      caption="Open appeals"
      rows={appeals}
      rowKey={(appeal) => appeal.id}
      href={(appeal) => `/appeals/${appeal.id}`}
      linkText={(appeal) => appeal.appealRef}
      empty="No open appeals."
      columns={[
        { header: 'State', cell: (appeal) => <StateTag state={appeal.state} /> },
        { header: 'Decision appealed', cell: (appeal) => words(appeal.appealedDecision) },
        { header: 'Review', cell: (appeal) => <span className="font-mono">{appeal.reviewRef}</span> },
        { header: 'Area', cell: (appeal) => areaText(appeal.area) },
        { header: 'Submitted', cell: (appeal) => formatDateTime(appeal.submittedAt) },
        { header: 'Claimed by', cell: (appeal) => appeal.claimedByName ?? '—' },
      ]}
    />
  );
}
