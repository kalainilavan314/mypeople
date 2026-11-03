import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

/** Open appeals in the person's areas, oldest first. */
export default function AppealsPage() {
  return (
    <>
      <PageHeader ta="சரிபார்ப்பு மேன்முறையீடுகள்" en="Verification appeals" />
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang="ta" className="text-xs text-muted">
          முந்தைய மதிப்பீட்டாளரைத் தவிர்த்த வேறு ஒருவரால் தீர்மானிக்கப்படும்; இறுதி முடிவு உறுப்பினருக்கு அறிவிக்கப்படும்.
        </p>
        <p className="text-muted">
          Decided by someone other than the original reviewer. The outcome and reason are final and shown to the member.
        </p>
      </div>
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
      empty={
        <div className="flex flex-col items-center justify-center text-center text-muted">
          <p lang="ta" className="text-sm font-semibold">
            மேன்முறையீடுகள் எதுவும் நிலுவையில் இல்லை
          </p>
          <p className="text-xs">No open verification appeals in your assigned areas.</p>
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
          cell: (appeal) => <StateTag state={appeal.state} />,
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">முடிவு</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Decision appealed</span>
            </>
          ),
          cell: (appeal) => words(appeal.appealedDecision),
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">சரிபார்ப்பு</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Review</span>
            </>
          ),
          cell: (appeal) => <span className="font-mono">{appeal.reviewRef}</span>,
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">பகுதி</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Area</span>
            </>
          ),
          cell: (appeal) => areaText(appeal.area),
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">சமர்ப்பிக்கப்பட்டது</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Submitted</span>
            </>
          ),
          cell: (appeal) => formatDateTime(appeal.submittedAt),
        },
        {
          header: (
            <>
              <span lang="ta" className="block text-text font-semibold">பொறுப்பேற்றவர்</span>
              <span lang="en" className="block text-[11px] text-muted font-normal">Claimed by</span>
            </>
          ),
          cell: (appeal) => appeal.claimedByName ?? '—',
        },
      ]}
    />
  );
}
