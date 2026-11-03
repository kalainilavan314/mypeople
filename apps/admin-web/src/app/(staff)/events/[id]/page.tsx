import type { EventRoster, ManagedEvent } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { cancelEvent, publishEvent, updateEvent } from '@/features/events/actions';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

const EVENT_TYPES = [
  { value: 'community_meeting', label: 'Community meeting' },
  { value: 'service_day', label: 'Service day' },
  { value: 'training', label: 'Training' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'town_hall', label: 'Town hall' },
  { value: 'other', label: 'Other' },
] as const;

export default function EventDetailPage(props: PageProps<'/events/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading event</p>}>
      <EventDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function EventDetail({ params, searchParams }: Pick<PageProps<'/events/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
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
            ← Back to events
          </Link>
          <p className="text-error">! {messageFor(err.code)}</p>
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
        <Link href="/events" className="flex flex-col text-sm font-semibold text-primary underline">
          <span lang="ta">← நிகழ்வுகளுக்குத் திரும்புக</span>
          <span lang="en" className="text-xs font-normal text-muted">Back to events</span>
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{event.eventRef}</span>
            <StateTag state={event.state} />
          </div>
          <h1 className="flex flex-col gap-0.5 text-2xl font-bold">
            <span lang="ta" className="text-2xl font-bold text-text">
              {event.titleTa}
            </span>
            <span lang="en" className="text-sm font-medium text-muted">
              {event.titleEn}
            </span>
          </h1>
          <p className="text-xs text-muted">
            Area: {areaText(event.areaKey)} · Type: {event.eventType.replace(/_/g, ' ')}
          </p>
        </div>
      </header>

      <Feedback error={error} problems={problems} done={done} />

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">Schedule & Check-in</span>
          <p className="mt-1 font-semibold">{formatDateTime(event.startsAt)}</p>
          <p className="text-xs text-muted">until {formatDateTime(event.endsAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Check-in: {formatDateTime(event.checkinOpensAt)} – {formatDateTime(event.checkinClosesAt)}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">RSVP status</span>
          <p className="mt-1 font-semibold">
            {event.going} {event.capacity ? `/ ${event.capacity}` : 'going'}
          </p>
          <p className="text-xs text-muted">{event.waitlisted > 0 ? `${event.waitlisted} on waitlist` : 'Capacity available'}</p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">Venue</span>
          <p className="mt-1 font-semibold">{event.venue}</p>
          {event.meetingPoint ? <p className="text-xs text-muted">Meeting: {event.meetingPoint}</p> : null}
        </div>
      </div>

      {isCancelled ? (
        <section aria-labelledby="cancelled-notice" className="rounded-xl border border-error bg-error-bg p-4 text-error">
          <h2 id="cancelled-notice" className="font-bold">
            ! Event has been cancelled
          </h2>
          <p className="mt-1 text-sm">
            Cancelled on {formatDateTime(event.cancelledAt)}. Reason recorded: {event.cancelReason ?? 'No reason provided.'}
          </p>
          <p className="mt-1 text-xs">All issued event passes are invalidated and members were notified.</p>
        </section>
      ) : null}

      {/* Attendance & Check-in Roster (for published events) */}
      {isPublished && attendance ? (
        <section aria-labelledby="attendance-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 id="attendance-heading" className="text-base font-bold">
              Attendance roster & check-in
            </h2>
            <span className="text-xs text-muted">
              {attendance.attended} attended of {attendance.expected} expected (
              {attendance.expected > 0 ? Math.round((attendance.attended / attendance.expected) * 100) : 0}%)
            </span>
          </div>

          {attendance.entries.length === 0 ? (
            <p className="text-sm text-muted">No attendees checked in yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Attendees list</caption>
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Member</th>
                    <th scope="col" className="px-3 py-2">Name</th>
                    <th scope="col" className="px-3 py-2">Check-in time</th>
                    <th scope="col" className="px-3 py-2">Method</th>
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
            <h2 id="publish-heading" className="text-base font-bold">
              Publish event
            </h2>
            <p className="text-xs text-muted">
              Publishing will make this event visible to members in {areaText(event.areaKey)} and open RSVPs.
            </p>
          </div>

          <form action={publishEvent} className="flex flex-col gap-4">
            <input type="hidden" name="eventId" value={event.id} />

            <div className="rounded-lg border border-warning/50 bg-warning-bg/30 p-4">
              <label className="flex items-start gap-2 text-sm font-semibold">
                <input type="checkbox" name="confirmPublish" value="1" required className="mt-0.5" />
                <span>
                  I confirm this event details are verified and ready for public attendance. Publishing cannot be quietly
                  undone; cancellation requires an audited reason.
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="primary">Publish event now</SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Edit Event Form (draft or published) */}
      {!isCancelled ? (
        <section aria-labelledby="edit-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="edit-heading" className="text-base font-bold">
              {isDraft ? 'Edit draft details' : 'Update event details'}
            </h2>
            {isPublished ? (
              <p className="text-xs text-warning">
                ! Note: Modifying dates, timing, or venue on a published event will automatically trigger notification SMS
                updates to members who have RSVP&apos;d.
              </p>
            ) : null}
          </div>

          <form action={updateEvent} className="flex flex-col gap-6">
            <input type="hidden" name="eventId" value={event.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Title (English)
                <input
                  name="titleEn"
                  defaultValue={event.titleEn}
                  maxLength={160}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Title (Tamil / தமிழ்)
                <input
                  name="titleTa"
                  defaultValue={event.titleTa}
                  maxLength={160}
                  lang="ta"
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Event type
                <select name="eventType" defaultValue={event.eventType} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Capacity limit (leave empty for unlimited)
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
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Description (English)
                <textarea
                  name="descriptionEn"
                  defaultValue={event.descriptionEn}
                  rows={3}
                  maxLength={4000}
                  className="rounded-lg border border-line p-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Description (Tamil / தமிழ்)
                <textarea
                  name="descriptionTa"
                  defaultValue={event.descriptionTa}
                  rows={3}
                  maxLength={4000}
                  lang="ta"
                  className="rounded-lg border border-line p-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Starts at (Sri Lankan time) *
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.startsAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Ends at (Sri Lankan time) *
                <input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.endsAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Check-in opens at (Sri Lankan time)
                <span className="text-xs font-normal text-muted">Defaults to 1 hour before start</span>
                <input
                  name="checkinOpensAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.checkinOpensAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Check-in closes at (Sri Lankan time)
                <span className="text-xs font-normal text-muted">Defaults to event end time</span>
                <input
                  name="checkinClosesAt"
                  type="datetime-local"
                  defaultValue={toSriLankaDateTimeInput(event.checkinClosesAt)}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Venue name and address
                <input
                  name="venue"
                  defaultValue={event.venue}
                  maxLength={300}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Meeting point
                <input
                  name="meetingPoint"
                  defaultValue={event.meetingPoint}
                  maxLength={300}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Accessibility details
                <input
                  name="accessibility"
                  defaultValue={event.accessibility}
                  maxLength={1000}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Contact route
                <input
                  name="contactRoute"
                  defaultValue={event.contactRoute}
                  maxLength={300}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="primary">Save changes</SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Cancel Event Section (for draft or published) */}
      {!isCancelled ? (
        <section aria-labelledby="cancel-heading" className="flex flex-col gap-4 rounded-xl border border-error/50 bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="cancel-heading" className="text-base font-bold text-error">
              Cancel event
            </h2>
            <p className="text-xs text-muted">
              Cancelling is an irreversible privileged action. Issued QR passes will expire and RSVP&apos;d members will be notified.
            </p>
          </div>

          <form action={cancelEvent} className="flex flex-col gap-4">
            <input type="hidden" name="eventId" value={event.id} />

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Cancellation reason (required) *
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                placeholder="Explain why this event is being cancelled (sent to attendees)..."
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="confirmCancel" value="1" required />
              <span>I confirm that this event must be cancelled and attendees notified.</span>
            </label>

            <div className="flex justify-end">
              <SubmitButton tone="danger">Cancel event</SubmitButton>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
