import { ApiError, type AppointmentCalendar, type AppointmentCalendarSlot, type RepresentativeOwnProfile } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import {
  addOwnSlots,
  approveOwnContacts,
  cancelBooking,
  recordFollowUp,
  updateOwnProfile,
  withdrawOwnSlot,
} from '@/features/representatives/actions';
import { CANCEL_FIELDS, FOLLOW_UP_FIELDS, REASON_FIELDS, SLOT_SERIES_FIELDS } from '@/features/representatives/fields';
import {
  APPOINTMENT_STATE_LABELS,
  APPOINTMENT_STATE_TONES,
  APPOINTMENT_TARGETS,
  CONTACT_LABELS,
  NEED_LABELS,
  PROFILE_STATE_LABELS,
  PROFILE_STATE_TONES,
  SLOT_MODE_LABELS,
  colomboTime,
  groupByDay,
  hasStarted,
} from '@/features/representatives/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'The appointment calendar is for staff who hold a public role with the permission to manage their own calendar.';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** S17 on the web: the representative's own slots, bookings, needs and follow-up notes, and their own profile. */
export default function OwnCalendarPage(props: PageProps<'/representatives/calendar'>) {
  return (
    <>
      <BackLink href="/representatives">Back to representatives</BackLink>
      <PageHeader ta="எனது சந்திப்பு நாட்காட்டி" en="My appointment calendar" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <Calendar searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<'/representatives/calendar'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const from = one(query.from);
  const since = from && DATE.test(from) ? from : undefined;

  let calendar: AppointmentCalendar;
  try {
    calendar = await (await staffApi()).getAppointmentCalendar({ from: since, days: 45 });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Meet Your Representative" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The calendar is not available." />;
  }
  const profile = calendar.profile;
  if (!profile) {
    return (
      <>
        <Feedback done={one(query.done)} />
        <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">
          You have no representative profile yet. A profile manager creates it under Representatives with your member ID; your
          calendar opens here once it exists.
        </p>
      </>
    );
  }
  const areaNames = await loadAreaNames([profile.areaKey]);
  const days = groupByDay(calendar.slots);
  const anyRoute = Boolean(profile.publicPhone || profile.publicEmail || profile.officeAddressEn || profile.officeAddressTa);

  return (
    <>
      <Feedback done={one(query.done)} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="bookings" ta="சந்திப்புகள்" en={`Slots and bookings (${calendar.slots.length})`} intro="Only you see who booked, what they want to talk about and what they need. After a meeting, record what happened: the member reads your follow-up note.">
            <form method="get" className="flex flex-wrap items-end gap-3">
              <label htmlFor="calendar-from" className="flex flex-col gap-1 text-sm font-semibold text-text">
                Show 45 days from
                <input id="calendar-from" name="from" type="date" defaultValue={since ?? ''} className={CONTROL} />
              </label>
              <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
                Show
              </button>
              {since ? (
                <Link href="/representatives/calendar" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
                  From a week ago
                </Link>
              ) : null}
            </form>
            {days.length === 0 ? (
              <p className="text-sm text-muted">No slots in these days. Add slots so members can book; until then they see your office hours.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {days.map(({ day, slots }) => (
                  <div key={day} className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-text">{formatDate(`${day}T12:00:00+05:30`)}</h3>
                    <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                      {slots.map((slot) => (
                        <SlotRow key={slot.id} slot={slot} started={hasStarted(slot.startsAt)} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside aria-label="Your profile and slots" className="flex flex-col gap-4">
          <section aria-labelledby="own-profile-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 text-sm">
            <h2 id="own-profile-heading" className="font-bold text-text">
              <span lang="ta">எனது பொது விவரம்</span> · My public profile
            </h2>
            <div className="flex flex-wrap gap-2">
              <BilingualTag label={PROFILE_STATE_LABELS[profile.state]} tone={PROFILE_STATE_TONES[profile.state]} />
            </div>
            <dl className="flex flex-col gap-3">
              <Detail label="Role"><Both ta={profile.roleTa} en={profile.roleEn} /></Detail>
              <Detail label="Area covered">{areaText(profile.areaKey, areaNames, 'en')}</Detail>
            </dl>
            <p className="rounded-lg bg-surface p-3 text-text">
              {profile.contactsApprovedAt
                ? `You approved your contact routes on ${formatDateTime(profile.contactsApprovedAt)}. Members see them.`
                : anyRoute
                  ? 'Members do not see your contact routes until you approve them.'
                  : 'You have no contact routes. Members see your office hours and free slots.'}
            </p>
            {anyRoute ? (
              <SimpleForm
                id="contacts"
                action={approveOwnContacts}
                hidden={{ approve: profile.contactsApprovedAt ? '0' : '1' }}
                fields={[]}
                submits={[{ label: profile.contactsApprovedAt ? 'Hide my contact routes from members' : 'Approve and show my contact routes', tone: profile.contactsApprovedAt ? 'secondary' : 'primary' }]}
                targets={APPOINTMENT_TARGETS}
              />
            ) : null}
          </section>
          {profile.state === 'withdrawn' ? null : (
            <>
              <SimpleForm
                id="own-profile"
                title="Office hours and contact routes"
                intro="Official routes only, never a private address or phone number. Saving with “show” ticked is your approval for members to see them."
                action={updateOwnProfile}
                fields={ownProfileFields(profile)}
                submits={[{ label: 'Save' }]}
                targets={APPOINTMENT_TARGETS}
              />
              <SimpleForm
                id="add-slots"
                title="Add appointment slots"
                intro="Consecutive slots of one length; they never overlap your other slots."
                action={addOwnSlots}
                fields={SLOT_SERIES_FIELDS}
                submits={[{ label: 'Add slots' }]}
                targets={APPOINTMENT_TARGETS}
              />
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function ownProfileFields(profile: RepresentativeOwnProfile): FieldSpec[] {
  return [
    { name: 'officeHoursTa', label: 'Office hours in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 3, maxLength: 700, rows: 2, defaultValue: profile.officeHoursTa },
    { name: 'officeHoursEn', label: 'Office hours in English', kind: 'textarea', lang: 'en', required: true, minLength: 3, maxLength: 500, rows: 2, defaultValue: profile.officeHoursEn },
    { name: 'publicPhone', label: 'Office phone', maxLength: 20, defaultValue: profile.publicPhone ?? '', hint: 'For example 021 222 3344.' },
    { name: 'publicEmail', label: 'Official e-mail', maxLength: 200, defaultValue: profile.publicEmail ?? '' },
    { name: 'officeAddressTa', label: 'Office address in Tamil', kind: 'textarea', lang: 'ta', maxLength: 450, rows: 2, defaultValue: profile.officeAddressTa ?? '' },
    { name: 'officeAddressEn', label: 'Office address in English', kind: 'textarea', lang: 'en', maxLength: 300, rows: 2, defaultValue: profile.officeAddressEn ?? '' },
    {
      name: 'showContacts',
      label: 'Show these contact routes to members',
      kind: 'checkbox',
      defaultValue: profile.contactsApprovedAt ? '1' : '',
      hint: 'Leave it unticked to keep them hidden.',
    },
  ];
}

/** One slot with its booking: who, the topic, contact preference, needs and any consented case reference. */
function SlotRow({ slot, started }: { slot: AppointmentCalendarSlot; started: boolean }) {
  const booking = slot.booking;
  const live = booking && booking.state !== 'cancelled' ? booking : null;
  return (
    <li className="flex flex-col gap-2 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold tabular-nums">
          {colomboTime(slot.startsAt)}–{colomboTime(slot.endsAt)}
        </span>
        <BilingualTag label={SLOT_MODE_LABELS[slot.mode]} />
        {slot.state === 'withdrawn' ? (
          <BilingualTag label={{ ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' }} />
        ) : live ? (
          <BilingualTag label={APPOINTMENT_STATE_LABELS[live.state]} tone={APPOINTMENT_STATE_TONES[live.state]} />
        ) : (
          <BilingualTag label={{ ta: 'காலியாக உள்ளது', en: 'Free' }} tone="done" />
        )}
        {slot.placeEn ? <span className="text-xs text-muted">{slot.placeEn}</span> : null}
      </p>
      {slot.withdrawnReason ? <p className="text-xs text-muted">Withdrawn: {slot.withdrawnReason}</p> : null}

      {booking ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text">{booking.memberName}</span>
            <span className="font-mono text-xs text-muted">{booking.memberCode}</span>
            <span className="font-mono text-xs text-muted">{booking.appointmentRef}</span>
            {booking.state === 'cancelled' ? (
              <BilingualTag label={APPOINTMENT_STATE_LABELS.cancelled} />
            ) : null}
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><Detail label="What they want to talk about">{booking.topic}</Detail></div>
            <Detail label="How to contact them">
              {CONTACT_LABELS[booking.contactPreference].en}
              {booking.contactPhone ? ` · ${booking.contactPhone}` : ''}
            </Detail>
            <Detail label="Needs">
              {booking.needs.length > 0 ? booking.needs.map((need) => NEED_LABELS[need].en).join(', ') : 'None given'}
            </Detail>
            {booking.needsNote ? <div className="sm:col-span-2"><Detail label="About their needs">{booking.needsNote}</Detail></div> : null}
            {booking.caseRef ? (
              <Detail label="Case reference (linked with their consent)">
                <span className="font-mono">{booking.caseRef}</span>
                {booking.caseConsentAt ? <span className="block text-xs text-muted">consent {formatDateTime(booking.caseConsentAt)}</span> : null}
              </Detail>
            ) : null}
            <Detail label="Booked">{formatDateTime(booking.bookedAt)}</Detail>
          </dl>
          {booking.state === 'cancelled' ? (
            <p className="text-xs text-muted">
              Cancelled by {booking.cancelledBy === 'member' ? 'the member' : 'you'} {formatDateTime(booking.cancelledAt)}
              {booking.cancelReason ? `: ${booking.cancelReason}` : ''}
            </p>
          ) : null}
          {booking.followUpNote ? (
            <div className="rounded-lg border border-line bg-card p-2">
              <p className="text-xs font-semibold text-muted">Follow-up note the member reads · {formatDateTime(booking.followUpAt)}</p>
              <p className="whitespace-pre-wrap text-text">{booking.followUpNote}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {live && started ? (
        <details className="text-sm" open={live.state === 'booked'}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">
            {live.state === 'booked' ? 'Record what happened' : 'Change the follow-up'}
          </summary>
          <SimpleForm
            id={`follow-up-${live.id.slice(0, 8)}`}
            action={recordFollowUp}
            hidden={{ appointmentId: live.id }}
            fields={FOLLOW_UP_FIELDS}
            submits={[{ label: 'Save follow-up' }]}
            targets={APPOINTMENT_TARGETS}
          />
        </details>
      ) : null}
      {live && live.state === 'booked' && !started ? (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Cancel this booking</summary>
          <SimpleForm
            id={`cancel-${live.id.slice(0, 8)}`}
            action={cancelBooking}
            hidden={{ appointmentId: live.id }}
            fields={CANCEL_FIELDS}
            submits={[{ label: 'Cancel booking', tone: 'danger' }]}
            targets={APPOINTMENT_TARGETS}
          />
        </details>
      ) : null}
      {slot.state === 'open' && !started ? (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Withdraw this slot</summary>
          <p className="text-xs text-muted">{live ? 'The booking on it is cancelled and the member told your reason.' : 'Members can no longer book it.'}</p>
          <SimpleForm
            id={`slot-${slot.id.slice(0, 8)}`}
            action={withdrawOwnSlot}
            hidden={{ slotId: slot.id }}
            fields={REASON_FIELDS}
            submits={[{ label: 'Withdraw slot', tone: 'danger' }]}
            targets={APPOINTMENT_TARGETS}
          />
        </details>
      ) : null}
    </li>
  );
}
