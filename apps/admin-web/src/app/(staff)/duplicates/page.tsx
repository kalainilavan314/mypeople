import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

/** Open duplicate-account investigations over both accounts' areas, oldest first. */
export default function DuplicatesPage() {
  return (
    <>
      <PageHeader ta="இரட்டைக் கணக்கு விசாரணைகள்" en="Duplicate investigations" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Cases />
      </Suspense>
    </>
  );
}

async function Cases() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let cases;
  try {
    cases = await (await staffApi()).listDuplicateCases({ limit: 100 });
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  return (
    <>
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang={locale} className="text-muted">
          {locale === 'ta'
            ? 'விசாரணை முடிவுகள் கணக்குகளைத் தானாக மாற்றாது; முறைப்பாட்டாளர் வழக்கை விசாரிக்க முடியாது.'
            : 'An investigation finding documents whether accounts belong to the same person. Separate operational decisions are required for each account.'}
        </p>
      </div>
      <RecordTable
        caption="Open investigations"
        locale={locale}
        rows={cases}
        rowKey={(item) => item.id}
        href={(item) => `/duplicates/${item.id}`}
        linkText={(item) => item.caseRef}
        empty={
          <div className="flex flex-col items-center justify-center text-center text-muted">
            <p lang={locale} className="text-sm font-semibold">
              {locale === 'ta' ? 'விசாரணைகள் எதுவும் நிலுவையில் இல்லை' : 'No open duplicate investigations in your assigned areas.'}
            </p>
          </div>
        }
        columns={[
        {
          header: <span lang={locale}>{locale === 'ta' ? 'நிலை' : 'State'}</span>,
          cell: (item) => <StateTag state={item.state} />,
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'சமிக்ஞை' : 'Signal'}</span>,
          cell: (item) => words(item.signal),
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'தொடங்கப்பட்டது' : 'Opened'}</span>,
          cell: (item) => formatDateTime(item.openedAt),
        },
        {
          header: <span lang={locale}>{locale === 'ta' ? 'பொறுப்பேற்றவர்' : 'Claimed by'}</span>,
          cell: (item) => item.claimedByName ?? '—',
        },
      ]}
    />
    </>
  );
}
