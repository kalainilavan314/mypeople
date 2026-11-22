import { ApiError, type RepresentativeManagedDetail } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { addSlotsFor, publishProfile, withdrawProfile, withdrawSlotFor } from '@/features/representatives/actions';
import { REASON_FIELDS, SLOT_SERIES_FIELDS } from '@/features/representatives/fields';
import {
  APPOINTMENT_TARGETS,
  PROFILE_STATE_LABELS,
  PROFILE_STATE_TONES,
  SLOT_MODE_LABELS,
  colomboTime,
  groupByDay,
  hasStarted,
  profileValues,
} from '@/features/representatives/forms';
import { ProfileForm } from '@/features/representatives/ProfileForm';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This profile does not exist or is outside your areas.';
const REFUSED = 'Representative profiles need the permission to publish representative profiles.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D29: one profile, its publication, and its slots (taken or free, never by whom). */
export default function RepresentativePage(props: PageProps<'/representatives/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <ProfileView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ProfileView({ params, searchParams }: Pick<PageProps<'/representatives/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/representatives">Back to representatives</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let profile: RepresentativeManagedDetail;
  try {
    profile = await (await staffApi()).getRepresentativeProfile(id);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Meet Your Representative" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const areaNames = await loadAreaNames([profile.areaKey]);
  const withdrawn = profile.state === 'withdrawn';
  const anyRoute = Boolean(profile.publicPhone || profile.publicEmail || profile.officeAddressEn || profile.officeAddressTa);
  const days = groupByDay(profile.slots);

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <BilingualTag label={PROFILE_STATE_LABELS[profile.state]} tone={PROFILE_STATE_TONES[profile.state]} />
          {profile.holdsCalendarPermission ? null : (
            <BilingualTag label={{ ta: 'நாட்காட்டி அனுமதி இல்லை', en: 'No calendar permission' }} tone="refused" />
          )}
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{profile.displayNameTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {profile.displayNameEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {profile.roleEn} · {areaText(profile.areaKey, areaNames, 'en')}
          {profile.publishedAt ? ` · published ${formatDateTime(profile.publishedAt)}` : ''}
        </p>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="profile" ta="பொது விவரம்" en="Public profile">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Official role"><Both ta={profile.roleTa} en={profile.roleEn} /></Detail>
              <Detail label="Area covered"><Both ta={areaText(profile.areaKey, areaNames, 'ta')} en={areaText(profile.areaKey, areaNames, 'en')} /></Detail>
              <div className="sm:col-span-2"><Detail label="Office hours"><Both ta={profile.officeHoursTa} en={profile.officeHoursEn} /></Detail></div>
              <Detail label="Office phone">{profile.publicPhone || '—'}</Detail>
              <Detail label="Official e-mail">{profile.publicEmail || '—'}</Detail>
              <div className="sm:col-span-2"><Detail label="Office address"><Both ta={profile.officeAddressTa} en={profile.officeAddressEn} /></Detail></div>
            </dl>
            <p className="rounded-lg bg-surface p-3 text-sm text-text">
              {profile.contactsApprovedAt
                ? `The person approved these contact routes on ${formatDateTime(profile.contactsApprovedAt)}; members see them.`
                : anyRoute
                  ? 'Members do not see these contact routes yet: the person has not approved them. They approve them in their own appointment calendar.'
                  : 'No contact routes. Members see the office hours and the free slots.'}
            </p>
            {profile.withdrawnReason ? (
              <p className="text-sm text-text">
                <span className="font-semibold">Withdrawn because:</span> {profile.withdrawnReason}
              </p>
            ) : null}
          </Section>

          <Section
            id="slots"
            ta="சந்திப்பு நேரங்கள்"
            en={`Appointment slots (${profile.slots.length})`}
            intro="From a week ago onward. You see whether a slot is taken, never who booked it. Withdrawing a taken slot cancels the booking and tells the member your reason.">
            {days.length === 0 ? (
              <p className="text-sm text-muted">No slots. Members see the office hours and “no appointments available”.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {days.map(({ day, slots }) => (
                  <div key={day} className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-text">{formatDate(`${day}T12:00:00+05:30`)}</h3>
                    <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                      {slots.map((slot) => {
                        const ahead = !hasStarted(slot.startsAt);
                        return (
                          <li key={slot.id} className="flex flex-col gap-2 p-3 text-sm">
                            <p className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold tabular-nums">
                                {colomboTime(slot.startsAt)}–{colomboTime(slot.endsAt)}
                              </span>
                              <BilingualTag label={SLOT_MODE_LABELS[slot.mode]} />
                              {slot.state === 'withdrawn' ? (
                                <BilingualTag label={{ ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' }} />
                              ) : slot.booked ? (
                                <BilingualTag label={{ ta: 'பதிவு செய்யப்பட்டது', en: 'Taken' }} tone="waiting" />
                              ) : (
                                <BilingualTag label={{ ta: 'காலியாக உள்ளது', en: 'Free' }} tone="done" />
                              )}
                              {slot.placeEn ? <span className="text-xs text-muted">{slot.placeEn}</span> : null}
                            </p>
                            {slot.state === 'open' && ahead && !withdrawn ? (
                              <details className="text-sm">
                                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Withdraw this slot</summary>
                                <SimpleForm
                                  id={`slot-${slot.id.slice(0, 8)}`}
                                  action={withdrawSlotFor}
                                  hidden={{ representativeId: profile.id, slotId: slot.id }}
                                  fields={REASON_FIELDS}
                                  submits={[{ label: 'Withdraw slot', tone: 'danger' }]}
                                  targets={APPOINTMENT_TARGETS}
                                />
                              </details>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {withdrawn ? null : (
            <Section id="edit" ta="விவரத்தை மாற்றுதல்" en="Change the profile" intro="The person and the area do not change. A change to a contact route asks the person to approve it again.">
              <ProfileForm representativeId={profile.id} current={profileValues(profile)} />
            </Section>
          )}
        </div>

        <aside aria-label="Publication and slots" className="flex flex-col gap-4">
          {profile.state !== 'published' ? (
            profile.holdsCalendarPermission ? (
              <SimpleForm
                id="publish"
                title={profile.state === 'withdrawn' ? 'Publish again' : 'Publish the profile'}
                intro="Members then see the role, area, office hours, approved contact routes and free slots."
                action={publishProfile}
                hidden={{ representativeId: profile.id }}
                fields={[]}
                submits={[{ label: 'Publish profile' }]}
                targets={APPOINTMENT_TARGETS}
              />
            ) : (
              <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">
                This profile cannot be published yet: the person does not hold the permission to manage their own appointment
                calendar (PRM-56), so no one would see the bookings. Ask an administrator to grant it in Roles and access.
              </p>
            )
          ) : null}
          {withdrawn ? null : (
            <SimpleForm
              id="add-slots"
              title="Add appointment slots"
              intro="Consecutive slots of one length. Slots never overlap; the API refuses one that does."
              action={addSlotsFor}
              hidden={{ representativeId: profile.id }}
              fields={SLOT_SERIES_FIELDS}
              submits={[{ label: 'Add slots' }]}
              targets={APPOINTMENT_TARGETS}
            />
          )}
          {profile.state === 'published' ? (
            <SimpleForm
              id="withdraw"
              title="Withdraw the profile"
              intro="It leaves the members’ list. Bookings still ahead are cancelled and their members told your reason."
              action={withdrawProfile}
              hidden={{ representativeId: profile.id }}
              fields={REASON_FIELDS}
              submits={[{ label: 'Withdraw profile', tone: 'danger' }]}
              targets={APPOINTMENT_TARGETS}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
