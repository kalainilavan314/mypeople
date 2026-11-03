import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

/** Open appeals in the person's areas, oldest first. */
export default function AppealsPage() {
  return (
    <>
      <PageHeader ta="சரிபார்ப்பு மேன்முறையீடுகள்" en="Verification appeals" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Appeals />
      </Suspense>
    </>
  );
}

async function Appeals() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let appeals;
  try {
    appeals = await (await staffApi()).listIdentityAppeals({ limit: 100 });
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  return (
    <>
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang={locale} className="text-muted">
          {locale === 'ta'
            ? 'முந்தைய மதிப்பீட்டாளரைத் தவிர்த்த வேறு ஒருவரால் தீர்மானிக்கப்படும்; இறுதி முடிவு உறுப்பினருக்கு அறிவிக்கப்படும்.'
            : 'Decided by someone other than the original reviewer. The outcome and reason are final and shown to the member.'}
        </p>
      </div>
      <RecordTable
        caption="Open appeals"
      rows={appeals}
      rowKey={(appeal) => appeal.id}
      href={(appeal) => `/appeals/${appeal.id}`}
      linkText={(appeal) => appeal.appealRef}
      empty={
        <div className="flex flex-col items-center justify-center text-center text-muted">
          <p lang={locale} className="text-sm font-semibold">
            {locale === 'ta' ? 'மேன்முறையீடுகள் எதுவும் நிலுவையில் இல்லை' : 'No open verification appeals in your assigned areas.'}
          </p>
        </div>
      }
      columns={[
        {
          header: <span lang={locale}>{locale === 'ta' ? 'நிலை' : 'State'}</span>,
          cell: (appeal) => <StateTag state={appeal.state} />,
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'முடிவு' : 'Decision appealed'}</span>,
          cell: (appeal) => words(appeal.appealedDecision),
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'சரிபார்ப்பு' : 'Review'}</span>,
          cell: (appeal) => <span className="font-mono">{appeal.reviewRef}</span>,
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'பகுதி' : 'Area'}</span>,
          cell: (appeal) => areaText(appeal.area),
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'சமர்ப்பிக்கப்பட்டது' : 'Submitted'}</span>,
          cell: (appeal) => formatDateTime(appeal.submittedAt),
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'பொறுப்பேற்றவர்' : 'Claimed by'}</span>,
          cell: (appeal) => appeal.claimedByName ?? '—',
        },
      ]}
    />
    </>
  );
}
