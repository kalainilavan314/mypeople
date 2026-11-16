import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { findHouseholdMember } from '@/features/households/actions';
import { getAdminLocale } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

export default function MembersSearchPage(props: PageProps<'/members'>) {
  return (
    <>
      <PageHeader ta="உறுப்பினர்களும் குடும்பங்களும்" en="Members and households" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <MembersSearchContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function MembersSearchContent({ searchParams }: { searchParams: PageProps<'/members'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;

  if (!staff.permissions.has('household.view_for_case')) {
    return (
      <section className="rounded-xl border border-error bg-error-bg p-4 text-sm text-error">
        <p lang={locale} className="font-semibold">
          ! {locale === 'ta'
            ? 'இப்பக்கத்தை அணுகுவதற்குத் தேவையான அனுமதி (PRM-33) உங்களிடம் இல்லை.'
            : 'You do not have the required permission (household.view_for_case) to access this page.'}
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p lang={locale}>
          {locale === 'ta'
            ? 'விவகார மேலாண்மைக்கான குடும்பத் தகவல்கள் (SC-22, PRM-33). உங்கள் ஆளுகைப் பகுதிக்குட்பட்ட உறுப்பினரின் குடும்பக் கோப்பைத் திறக்க உறுப்பினர் அடையாளக் குறியீட்டை உள்ளிடவும்.'
            : 'Household records for casework operations (SC-22, PRM-33). Enter a member ID code to open their household file within your permitted area.'}
        </p>
      </div>

      <Feedback error={query.error} />

      <form action={findHouseholdMember} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">
            {locale === 'ta' ? 'உறுப்பினர் அடையாளக் குறியீடு (Member ID) *' : 'Member ID Code *'}
          </span>
          <input
            name="code"
            required
            minLength={3}
            placeholder="NPM-XXXX"
            className="min-h-11 rounded-lg border border-line px-3 font-mono text-sm"
          />
        </label>
        <SubmitButton tone="secondary">
          <span lang={locale}>{locale === 'ta' ? 'கோப்பைத் திறக்குக' : 'Open Record'}</span>
        </SubmitButton>
      </form>
    </div>
  );
}
