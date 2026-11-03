import type { StaffHouseholdView } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { HouseholdDetailView } from '@/features/households/HouseholdDetailView';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function MemberHouseholdPage(props: PageProps<'/members/[memberId]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading</p>}>
      <MemberHouseholdContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function MemberHouseholdContent({
  params,
  searchParams,
}: Pick<PageProps<'/members/[memberId]'>, 'params' | 'searchParams'>) {
  const staff = await requireStaff();
  const { memberId } = await params;
  const query = await searchParams;
  const locale = await getAdminLocale(staff.member.language);

  if (!staff.permissions.has('household.view_for_case')) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader ta="குடும்ப நிர்வாகம்" en="Household record" />
        <section className="rounded-xl border border-error bg-error-bg p-4 text-sm text-error">
          <p lang={locale} className="font-semibold">
            ! {locale === 'ta'
              ? 'இப்பக்கத்தை அணுகுவதற்குத் தேவையான அனுமதி (household.view_for_case) உங்களிடம் இல்லை.'
              : 'You do not have the required permission (household.view_for_case) to access this page.'}
          </p>
        </section>
      </div>
    );
  }

  let data: StaffHouseholdView;
  try {
    const api = await staffApi();
    data = await api.staffViewHousehold(memberId);
  } catch (error) {
    if (isRefusal(error)) {
      const isForbidden = error.status === 403 || error.code === 'forbidden' || error.code === 'not_in_your_area';
      return (
        <div className="flex flex-col gap-4">
          <PageHeader ta="குடும்ப நிர்வாகம்" en="Household record">
            <Link href="/members" className="text-sm text-primary underline">
              <span lang={locale}>{locale === 'ta' ? 'தேடலுக்குத் திரும்புக' : 'Back to search'}</span>
            </Link>
          </PageHeader>
          <section className="rounded-xl border border-error bg-error-bg p-4 text-sm text-error">
            <p lang={locale} className="font-semibold">
              ! {isForbidden
                ? locale === 'ta'
                  ? 'இந்த உறுப்பினர் உங்கள் ஆளுகைப் பகுதிக்கு உட்படாதவர் (PRM-33).'
                  : 'This member is outside your permitted geographic area (PRM-33).'
                : getLocalizedMessage(error.code, locale)}
            </p>
          </section>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader ta="குடும்ப நிர்வாகம்" en="Household record">
        <Link href="/members" className="text-sm text-primary underline">
          <span lang={locale}>{locale === 'ta' ? 'தேடலுக்குத் திரும்புக' : 'Back to search'}</span>
        </Link>
      </PageHeader>

      <Feedback error={query.error} />

      <HouseholdDetailView data={data} locale={locale} />
    </div>
  );
}
