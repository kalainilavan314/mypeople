import { ApiError, type RepresentativeManaged } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { PROFILE_STATES, PROFILE_STATE_LABELS, PROFILE_STATE_TONES } from '@/features/representatives/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'Representative profiles need the permission to publish representative profiles.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D29: representatives' role profiles in the viewer's areas, and the viewer's own calendar when they hold a public role. */
export default function RepresentativesPage(props: PageProps<'/representatives'>) {
  return (
    <>
      <PageHeader ta="பிரதிநிதிகளும் சந்திப்புகளும்" en="Representatives and appointments">
        <Suspense fallback={null}>
          <NewProfileLink />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={2} />}>
        <OwnCalendarLink />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <ProfileList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewProfileLink() {
  await connection();
  const staff = await requireStaff();
  return staff.permissions.has('appointment.profile.manage') ? <ButtonLink href="/representatives/new">New profile</ButtonLink> : null;
}

async function OwnCalendarLink() {
  await connection();
  const staff = await requireStaff();
  if (!staff.permissions.has('appointment.manage_own')) return null;
  return (
    <Section
      id="own-calendar"
      ta="எனது சந்திப்பு நாட்காட்டி"
      en="My appointment calendar"
      intro="Your own slots, the members booked with you, their needs, and the follow-up notes they read. Only you see who booked.">
      <Link href="/representatives/calendar" className={`inline-flex min-h-11 w-fit items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`}>
        Open my calendar
      </Link>
    </Section>
  );
}

async function ProfileList({ searchParams }: { searchParams: PageProps<'/representatives'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  if (!staff.permissions.has('appointment.profile.manage')) {
    return <Feedback done={one(query.done)} />;
  }
  const state = PROFILE_STATES.find((item) => item === one(query.state));

  let rows: RepresentativeManaged[];
  try {
    rows = await (await staffApi()).listRepresentativeProfiles(state);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Meet Your Representative" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The profiles are not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Role profiles in your areas. Members see a published profile with its role, area and office hours; contact routes appear
        only after the person approves them. Profile managers see whether a slot is taken, never who took it.
      </p>
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card shadow-card p-4">
        <label htmlFor="profile-state" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          State
          <select id="profile-state" name="state" defaultValue={state ?? ''} className={CONTROL}>
            <option value="">All profiles</option>
            {PROFILE_STATES.map((code) => (
              <option key={code} value={code}>
                {PROFILE_STATE_LABELS[code].ta} · {PROFILE_STATE_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Apply
        </button>
        {state ? (
          <Link href="/representatives" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear
          </Link>
        ) : null}
      </form>
      <RecordTable
        caption="Representative profiles"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Profile"
        href={(row) => `/representatives/${row.id}`}
        linkText={(row) => row.displayNameEn}
        empty={state ? 'No profiles in this state.' : 'No representative profiles in your areas yet. Start with “New profile”.'}
        columns={[
          { header: 'State', cell: (row) => <BilingualTag label={PROFILE_STATE_LABELS[row.state]} tone={PROFILE_STATE_TONES[row.state]} /> },
          { header: 'Role', cell: (row) => <BilingualText ta={row.roleTa} en={row.roleEn} className="max-w-xs" /> },
          { header: 'Area', cell: (row) => <BilingualText ta={areaText(row.areaKey, areaNames, 'ta')} en={areaText(row.areaKey, areaNames, 'en')} /> },
          {
            header: 'Contacts',
            cell: (row) =>
              row.contactsApprovedAt ? (
                <span className="text-xs text-success">approved by the person</span>
              ) : row.publicPhone || row.publicEmail || row.officeAddressEn ? (
                <span className="text-xs font-semibold text-warning">waiting for the person’s approval</span>
              ) : (
                <span className="text-xs text-muted">none entered</span>
              ),
          },
          {
            header: 'Free slots',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>{row.openSlots} free</span>
                <span>{row.nextOpenSlot ? `next ${formatDateTime(row.nextOpenSlot)}` : 'none ahead'}</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
