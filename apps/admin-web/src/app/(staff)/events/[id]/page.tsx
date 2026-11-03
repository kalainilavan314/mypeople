import type { EventRoster, ManagedEvent } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { cancelEvent, publishEvent, updateEvent } from '@/features/events/actions';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const EVENT_TYPES = [
  { value: 'community_meeting', ta: 'சமூகக் கூட்டம்', en: 'Community meeting' },
  { value: 'service_day', ta: 'சேவை நாள்', en: 'Service day' },
  { value: 'training', ta: 'பயிற்சி', en: 'Training' },
  { value: 'cultural', ta: 'கலாச்சார நிகழ்வு', en: 'Cultural' },
  { value: 'town_hall', ta: 'மக்கள் மன்றம்', en: 'Town hall' },
  { value: 'other', ta: 'ஏனையவை', en: 'Other' },
] as const;

export default function EventDetailPage(props: PageProps<'/events/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading event</p>}>
      <EventDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function EventDetail({ params, searchParams }: Pick<PageProps<'/events/[id]'>, 'params' | 'searchParams'>) {
  const staff = await requireStaff();
  const { id } = await params;
  const query = await searchParams;
  const locale = await getAdminLocale(staff.member.language);
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const problems = Array.isArray(query.problems) ? query.problems[0] : query.problems;
  const done = Array.isArray(query.done) ? query.done[0] : query.done;

  const api = await staffApi();
  let event: ManagedEvent;
  let attendance: EventRoster | null = null;

  try {
    event = await api.getManagedEvent(id);
    if (event.state === 'published') {
      try {
        attendance = await api.getEventAttendance(id);
      } catch {
        // Attendance may be unavailable if scanning permission is not held
      }
    }
  } catch (err) {
    if (isRefusal(err)) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/events" className="text-sm font-semibold text-primary underline">
            <span lang={locale}>{locale === 'ta' ? '← நிகழ்வுகளுக்குத் திரும்புக' : '← Back to events'}</span>
          </Link>
          <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>
        </div>
      );
    }
    throw err;
  }

  const isDraft = event.state === 'draft';
  const isPublished = event.state === 'published';
  const isCancelled = event.state === 'cancelled';

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/events" className="text-sm font-semibold text-primary underline">
          <span lang={locale}>{locale === 'ta' ? '← நிகழ்வுகளுக்குத் திரும்புக' : '← Back to events'}</span>
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{event.eventRef}</span>
            <StateTag state={event.state} />
          </div>
          <h1 lang={locale} className="text-2xl font-bold text-text">
            {locale === 'ta' ? event.titleTa || event.titleEn : event.titleEn || event.titleTa}
          </h1>
          <p className="text-xs text-muted">
            {locale === 'ta' ? 'பகுதி:' : 'Area:'} {areaText(event.areaKey)} · {locale === 'ta' ? 'வகை:' : 'Type:'} {event.eventType.replace(/_/g, ' ')}
          </p>
        </div>
      </header>

      <Feedback error={error} problems={problems} done={done} />

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">{locale === 'ta' ? 'நேர அட்டவணை & வருகைப்பதிவு' : 'Schedule & Check-in'}</span>
          <p className="mt-1 font-semibold">{formatDateTime(event.startsAt)}</p>
          <p className="text-xs text-muted">{locale === 'ta' ? 'முடிவு:' : 'until'} {formatDateTime(event.endsAt)}</p>
          <p className="mt-1 text-xs text-muted">
            {locale === 'ta' ? 'வருகைப்பதிவு:' : 'Check-in:'} {formatDateTime(event.checkinOpensAt)} – {formatDateTime(event.checkinClosesAt)}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">{locale === 'ta' ? 'பதிவு நிலை (RSVP)' : 'RSVP status'}</span>
          <p className="mt-1 font-semibold">
            {event.going} {event.capacity ? `/ ${event.capacity}` : (locale === 'ta' ? 'பதிவானவர்கள்' : 'going')}
          </p>
          <p className="text-xs text-muted">
            {event.waitlisted > 0
              ? `${event.waitlisted} ${locale === 'ta' ? 'காத்திருப்போர் பட்டியலில்' : 'on waitlist'}`
              : (locale === 'ta' ? 'இடங்கள் உள்ளன' : 'Capacity available')}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">{locale === 'ta' ? 'நிகழ்விடம்' : 'Venue'}</span>
          <p className="mt-1 font-semibold">{event.venue}</p>
          {event.meetingPoint ? <p className="text-xs text-muted">{locale === 'ta' ? 'சந்திக்கும் இடம்:' : 'Meeting:'} {event.meetingPoint}</p> : null}
        </div>
      </div>

      {isCancelled ? (
        <section aria-labelledby="cancelled-notice" className="rounded-xl border border-error bg-error-bg p-4 text-error">
          <h2 id="cancelled-notice" className="font-bold">
            ! {locale === 'ta' ? 'இந்நிகழ்வு ரத்துசெய்யப்பட்டுள்ளது' : 'Event has been cancelled'}
          </h2>
          <p className="mt-1 text-sm">
            {locale === 'ta' ? 'ரத்து செய்யப்பட்ட திகதி:' : 'Cancelled on'} {formatDateTime(event.cancelledAt)}. {locale === 'ta' ? 'காரணம்:' : 'Reason:'} {event.cancelReason ?? (locale === 'ta' ? 'காரணம் குறிப்பிடப்படவில்லை.' : 'No reason provided.')}
          </p>
          <p className="mt-1 text-xs">{locale === 'ta' ? 'வழங்கப்பட்ட அனைத்து நுழைவுச்சீட்டுகளும் முடக்கப்பட்டு உறுப்பினர்களுக்கு அறிவிக்கப்பட்டது.' : 'All issued event passes are invalidated and members were notified.'}</p>
        </section>
      ) : null}

      {/* Attendance & Check-in Roster (for published events) */}
      {isPublished && attendance ? (
        <section aria-labelledby="attendance-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 id="attendance-heading" className="text-base font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'வருகைப்பதிவேடு மற்றும் அனுமதி' : 'Attendance roster & check-in'}</span>
            </h2>
            <span className="text-xs text-muted">
              {attendance.attended} {locale === 'ta' ? 'பங்கேற்றவர்கள் /' : 'attended of'} {attendance.expected} {locale === 'ta' ? 'எதிர்பார்க்கப்படுபவர்கள்' : 'expected'} (
              {attendance.expected > 0 ? Math.round((attendance.attended / attendance.expected) * 100) : 0}%)
            </span>
          </div>

          {attendance.entries.length === 0 ? (
            <p className="text-sm text-muted">{locale === 'ta' ? 'இதுவரை வருகைப்பதிவு எதுவும் செய்யப்படவில்லை.' : 'No attendees checked in yet.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Attendees list</caption>
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'உறுப்பினர் இலக்கம்' : 'Member'}</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'பெயர்' : 'Name'}</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'வருகைப்பதிவு நேரம்' : 'Check-in time'}</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'முறை' : 'Method'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {attendance.entries.map((entry) => (
                    <tr key={entry.memberCode}>
                      <td className="px-3 py-2 font-mono font-medium">{entry.memberCode}</td>
                      <td className="px-3 py-2">{entry.fullName}</td>
                      <td className="px-3 py-2">{formatDateTime(entry.attendedAt)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold">
                          {entry.checkinMethod ?? 'scan'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* Lifecycle Actions: Publish or Cancel */}
      {isDraft ? (
        <section aria-labelledby="publish-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="publish-heading" className="text-base font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'நிகழ்வை வெளியிடல்' : 'Publish event'}</span>
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? `வெளியிடுவதன் மூலம் ${areaText(event.areaKey)} பகுதியிலுள்ள உறுப்பினர்கள் இந்நிகழ்வைக் காணவும் பதிவுசெய்யவும் முடியும்.`
                : `Publishing will make this event visible to members in ${areaText(event.areaKey)} and open RSVPs.`}
            </p>
          </div>

          <form action={publishEvent} className="flex flex-col gap-4">
            <input type="hidden" name="eventId" value={event.id} />

            <div className="rounded-lg border border-warning/50 bg-warning-bg/30 p-4">
              <label className="flex items-start gap-2 text-sm font-semibold text-text">
                <input type="checkbox" name="confirmPublish" value="1" required className="mt-0.5" />
                <span lang={locale}>
                  {locale === 'ta'
                    ? 'இந்நிகழ்வு விவரங்கள் சரிபார்க்கப்பட்டு பொது பார்வைக்குத் தயாராக உள்ளன என்பதை உறுதிப்படுத்துகிறேன். வெளியிடப்பட்ட பின் ரத்துசெய்வதற்கு முறையான காரணம் அவசியமாகும்.'
                    : 'I confirm this event details are verified and ready for public attendance. Publishing cannot be quietly undone; cancellation requires an audited reason.'}
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="primary">
                <span lang={locale}>{locale === 'ta' ? 'நிகழ்வை இப்போது வெளியிடுக' : 'Publish event now'}</span>
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Edit Event Form (draft or published) */}
      {!isCancelled ? (
        <section aria-labelledby="edit-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="edit-heading" className="text-base font-bold text-text">
              <span lang={locale}>
                {isDraft
                  ? locale === 'ta' ? 'வரைவு விவரங்களைத் திருத்துக' : 'Edit draft details'
                  : locale === 'ta' ? 'நிகழ்வு விவரங்களைப் புதுப்பிக்க' : 'Update event details'}
              </span>
            </h2>
            {isPublished ? (
              <p className="text-xs text-warning">
                ! {locale === 'ta'
                  ? 'வெளியிடப்பட்ட நிகழ்வில் திகதிகள், நேரம் அல்லது இடத்தை மாற்றுவது பதிவுசெய்த உறுப்பினர்களுக்கு தானியங்கி குறுஞ்செய்தி அறிவிப்பை அனுப்பும்.'
                  : 'Modifying dates, timing, or venue on a published event will automatically trigger notification SMS updates to members who have RSVP’d.'}
              </p>
            ) : null}
          </div>

          <form action={updateEvent} className="flex flex-col gap-6">
            <input type="hidden" name="eventId" value={event.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (தமிழ்) *' : 'Title (Tamil) *'}</span>
                <input
                  name="titleTa"
                  defaultValue={event.titleTa}
                  maxLength={160}
                  lang="ta"
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (ஆங்கிலம்) *' : 'Title (English) *'}</span>
                <input
                  name="titleEn"
                  defaultValue={event.titleEn}
                  maxLength={160}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'நிகழ்வு வகை *' : 'Event type *'}</span>
                <select name="eventType" defaultValue={event.eventType} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t[locale]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'பங்கேற்பாளர் எல்லை (வரம்பற்றதாயின் காலியாக விடவும்)' : 'Capacity limit (leave empty for unlimited)'}</span>
                <input
                  name="capacity"
                  type="number"
                  min={1}
                  defaultValue={event.capacity ?? ''}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'விளக்கம் (தமிழ்)' : 'Description (Tamil)'}</span>
                <textarea
                  name="descriptionTa"
                  defaultValue={event.descriptionTa}
                  rows={3}
                  maxLength={4000}
                  lang="ta"
                  className="rounded-lg border border-line p-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'விளக்கம் (ஆங்கிலம்)' : 'Description (English)'}</span>
                <textarea
                  name="descriptionEn"
                  defaultValue={event.descriptionEn}
                  rows={3}
                  maxLength={4000}
                  className="rounded-lg border border-line p-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'ஆரம்ப நேரம் (இலங்கை நேரம்) *' : 'Starts at (Sri Lankan time) *'}</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.startsAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'முடிவு நேரம் (இலங்கை நேரம்) *' : 'Ends at (Sri Lankan time) *'}</span>
                <input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.endsAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'வருகைப்பதிவு திறக்கும் நேரம் (இலங்கை நேரம்)' : 'Check-in opens at (Sri Lankan time)'}</span>
                <input
                  name="checkinOpensAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.checkinOpensAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'வருகைப்பதிவு முடிவடையும் நேரம் (இலங்கை நேரம்)' : 'Check-in closes at (Sri Lankan time)'}</span>
                <input
                  name="checkinClosesAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.checkinClosesAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'நிகழ்விடம் மற்றும் முகவரி' : 'Venue name and address'}</span>
                <input
                  name="venue"
                  defaultValue={event.venue}
                  maxLength={300}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'சந்திக்கும் இடம்' : 'Meeting point'}</span>
                <input
                  name="meetingPoint"
                  defaultValue={event.meetingPoint}
                  maxLength={300}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'அணுகல்தன்மைத் தகவல்' : 'Accessibility details'}</span>
                <input
                  name="accessibility"
                  defaultValue={event.accessibility}
                  maxLength={1000}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-text">
                <span lang={locale}>{locale === 'ta' ? 'தொடர்பு வழி' : 'Contact route'}</span>
                <input
                  name="contactRoute"
                  defaultValue={event.contactRoute}
                  maxLength={300}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="primary">
                <span lang={locale}>{locale === 'ta' ? 'மாற்றங்களைச் சேமிக்குக' : 'Save changes'}</span>
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Cancel Event Section (for draft or published) */}
      {!isCancelled ? (
        <section aria-labelledby="cancel-heading" className="flex flex-col gap-4 rounded-xl border border-error/50 bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="cancel-heading" className="text-base font-bold text-error">
              <span lang={locale}>{locale === 'ta' ? 'நிகழ்வை ரத்துசெய்க' : 'Cancel event'}</span>
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? 'ரத்துசெய்தல் மாற்றமுடியாத நடவடிக்கையாகும். வழங்கப்பட்ட QR அனுமதிச்சீட்டுகள் காலாவதியாகும் மற்றும் பதிவுசெய்த உறுப்பினர்களுக்கு அறிவிக்கப்படும்.'
                : 'Cancelling is an irreversible privileged action. Issued QR passes will expire and RSVP’d members will be notified.'}
            </p>
          </div>

          <form action={cancelEvent} className="flex flex-col gap-4">
            <input type="hidden" name="eventId" value={event.id} />

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'ரத்துசெய்வதற்கான காரணம் (கட்டாயமானது) *' : 'Cancellation reason (required) *'}</span>
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                placeholder={locale === 'ta' ? 'இந்நிகழ்வு ஏன் ரத்து செய்யப்படுகிறது என்பதை விளக்குக (பங்கேற்பாளர்களுக்கு அனுப்பப்படும்)...' : 'Explain why this event is being cancelled (sent to attendees)...'}
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input type="checkbox" name="confirmCancel" value="1" required />
              <span lang={locale}>
                {locale === 'ta'
                  ? 'இந்நிகழ்வு ரத்துசெய்யப்பட வேண்டும் மற்றும் பங்கேற்பாளர்களுக்கு அறிவிக்கப்பட வேண்டும் என்பதை உறுதிப்படுத்துகிறேன்.'
                  : 'I confirm that this event must be cancelled and attendees notified.'}
              </span>
            </label>

            <div className="flex justify-end">
              <SubmitButton tone="danger">
                <span lang={locale}>{locale === 'ta' ? 'நிகழ்வை ரத்துசெய்க' : 'Cancel event'}</span>
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
