import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { SubmitButton } from '@/components/SubmitButton';
import { findMember } from '@/features/members/actions';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

/** Verified members still pending in the person's areas, and any member's file by exact ID. */
export default function MembershipPage(props: PageProps<'/membership'>) {
  return (
    <>
      <PageHeader ta="உறுப்புரிமைச் செயற்படுத்தல்" en="Membership activation" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <MembershipContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function MembershipContent({ searchParams }: { searchParams: PageProps<'/membership'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  return (
    <>
      <div className="flex flex-col gap-0.5 text-sm">
        <p lang={locale} className="text-muted">
          {locale === 'ta'
            ? 'அடையாளச் சரிபார்ப்புடன் உறுப்புரிமை தானாகச் செயல்படாது; மாற்றங்களுக்குக் காரணம் அவசியமாகும்.'
            : 'A verified identity does not automatically activate membership. Every status change requires an explicit reason.'}
        </p>
      </div>
      <form action={findMember} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta' ? 'உறுப்பினர் அடையாளக் குறியீட்டை உள்ளிடவும் *' : 'Open a member by exact member ID *'}
          </span>
          <input name="code" required minLength={3} className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <SubmitButton tone="secondary">
          <span lang={locale}>{locale === 'ta' ? 'திறக்குக' : 'Open'}</span>
        </SubmitButton>
      </form>
      <Awaiting searchParams={searchParams} />
    </>
  );
}

async function Awaiting({ searchParams }: { searchParams: PageProps<'/membership'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  let members;
  try {
    members = await (await staffApi()).listAwaitingActivation(100);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  return (
    <>
      <Feedback error={query.error} />
      <h2 className="text-base font-bold text-text">
        <span lang={locale}>
          {locale === 'ta' ? 'சரிபார்க்கப்பட்டுச் செயற்படுத்தலுக்காகக் காத்திருப்பவர்கள்' : 'Verified and waiting for activation'}
        </span>
      </h2>
      <RecordTable
        caption="Members awaiting activation"
        rows={members}
        rowKey={(member) => member.id}
        href={(member) => `/membership/${member.id}`}
        linkText={(member) => member.memberCode}
        empty={
          <div className="flex flex-col items-center justify-center text-center text-muted">
            <p lang={locale} className="text-sm font-semibold">
              {locale === 'ta' ? 'செயற்படுத்தலுக்காக யாரும் காத்திருக்கவில்லை' : 'Nobody is waiting for membership activation in your areas.'}
            </p>
          </div>
        }
        columns={[
          {
            header: <span lang={locale}>{locale === 'ta' ? 'பெயர்' : 'Name'}</span>,
            cell: (member) => member.fullName,
          },
          {
            header: <span lang={locale}>{locale === 'ta' ? 'பகுதி' : 'Area'}</span>,
            cell: (member) => areaText(member.area),
          },
          {
            header: <span lang={locale}>{locale === 'ta' ? 'அடையாளம் சரிபார்க்கப்பட்டது' : 'Identity verified'}</span>,
            cell: (member) => formatDateTime(member.verifiedAt),
          },
        ]}
      />
    </>
  );
}
