import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createEvent } from '@/features/events/actions';
import { requireStaff } from '@/lib/staff';

const EVENT_TYPES = [
  { value: 'community_meeting', label: 'Community meeting' },
  { value: 'service_day', label: 'Service day' },
  { value: 'training', label: 'Training' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'town_hall', label: 'Town hall' },
  { value: 'other', label: 'Other' },
] as const;

export default function NewEventPage(props: PageProps<'/events/new'>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/events" className="text-sm font-semibold text-primary underline">
          ← Back to events
        </Link>
      </div>

      <PageHeader ta="புதிய நிகழ்வை உருவாக்குதல்" en="Create draft event" brd="D07, FR-ADM-004" />

      <Suspense fallback={<p className="text-muted">… Loading form</p>}>
        <NewEventForm searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewEventForm({ searchParams }: { searchParams: PageProps<'/events/new'>['searchParams'] }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const problems = Array.isArray(params.problems) ? params.problems[0] : params.problems;

  // Find areas where staff has events.manage permission
  const managedAssignments = staff.assignments.filter((a) => a.permissions.includes('events.manage'));

  return (
    <>
      <Feedback error={error} problems={problems} />

      <form action={createEvent} className="flex flex-col gap-6 rounded-xl border border-line bg-card p-6">
        <section aria-labelledby="section-basic" className="flex flex-col gap-4">
          <h2 id="section-basic" className="text-base font-bold">
            1. Event details
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Title (English) *
              <input
                name="titleEn"
                required
                maxLength={160}
                placeholder="e.g. Jaffna Town Community Meeting"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Title (Tamil / தமிழ்) *
              <input
                name="titleTa"
                required
                maxLength={160}
                placeholder="எ.கா. யாழ்ப்பாண நகர சமூகக் கூட்டம்"
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Event type *
              <select name="eventType" required defaultValue="community_meeting" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Assigned area *
              <select name="areaSelection" required className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {managedAssignments.map((a) => {
                  const label = a.area.level === 'platform' ? 'Platform wide' : `${a.area.level} ${a.area.code}`;
                  const value = `${a.area.level}:${a.area.code ?? ''}`;
                  return (
                    <option key={a.id} value={value}>
                      {label} (Tier {a.tier})
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Description (English)
              <textarea
                name="descriptionEn"
                rows={3}
                maxLength={4000}
                placeholder="Purpose and details of the event..."
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Description (Tamil / தமிழ்)
              <textarea
                name="descriptionTa"
                rows={3}
                maxLength={4000}
                placeholder="நிகழ்வின் நோக்கம் மற்றும் விவரங்கள்..."
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-schedule" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-schedule" className="text-base font-bold">
            2. Schedule and check-in
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Starts at (Sri Lankan time) *
              <input name="startsAt" type="datetime-local" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Ends at (Sri Lankan time) *
              <input name="endsAt" type="datetime-local" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Check-in opens at (optional)
              <span className="text-xs font-normal text-muted">Defaults to 1 hour before start</span>
              <input name="checkinOpensAt" type="datetime-local" className="min-h-11 rounded-lg border border-line px-3" />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Check-in closes at (optional)
              <span className="text-xs font-normal text-muted">Defaults to event end time</span>
              <input name="checkinClosesAt" type="datetime-local" className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-venue" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-venue" className="text-base font-bold">
            3. Venue and access
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Venue name and address *
              <input
                name="venue"
                required
                maxLength={300}
                placeholder="e.g. Town Hall Community Centre, Main Street"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Meeting point
              <input
                name="meetingPoint"
                maxLength={300}
                placeholder="e.g. North gate registration desk"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Accessibility information
              <input
                name="accessibility"
                maxLength={1000}
                placeholder="e.g. Wheelchair accessible entrance and seating available"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Contact route
              <input
                name="contactRoute"
                maxLength={300}
                placeholder="e.g. District Operations Desk: events@northunity.lk"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Capacity limit (optional)
              <span className="text-xs font-normal text-muted">Leave empty for unlimited RSVP capacity</span>
              <input
                name="capacity"
                type="number"
                min={1}
                placeholder="e.g. 150"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <div className="flex flex-col justify-end">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input name="admitsPending" type="checkbox" value="1" />
                Admit pending members (passes issued to unverified / pending)
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/events" className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-surface">
            Cancel
          </Link>
          <SubmitButton tone="primary">Save draft event</SubmitButton>
        </div>
      </form>
    </>
  );
}
