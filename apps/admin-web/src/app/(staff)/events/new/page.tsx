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
        <Link href="/events" className="flex flex-col text-sm font-semibold text-primary underline">
          <span lang="ta">← நிகழ்வுகளுக்குத் திரும்புக</span>
          <span lang="en" className="text-xs font-normal text-muted">Back to events</span>
        </Link>
      </div>

      <PageHeader ta="புதிய நிகழ்வை உருவாக்குதல்" en="Create draft event" />

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
            <span lang="ta" className="block text-xs font-semibold text-muted">1. நிகழ்வு விவரங்கள்</span>
            <span lang="en">1. Event details</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">நிகழ்வுத் தலைப்பு (தமிழ்) *</span>
              <span lang="en" className="text-xs">Title (Tamil) *</span>
              <input
                name="titleTa"
                required
                maxLength={160}
                placeholder="எ.கா. யாழ்ப்பாண நகர சமூகக் கூட்டம்"
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">நிகழ்வுத் தலைப்பு (ஆங்கிலம்) *</span>
              <span lang="en" className="text-xs">Title (English) *</span>
              <input
                name="titleEn"
                required
                maxLength={160}
                placeholder="e.g. Jaffna Town Community Meeting"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">நிகழ்வு வகை *</span>
              <span lang="en" className="text-xs">Event type *</span>
              <select name="eventType" required defaultValue="community_meeting" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">ஒதுக்கப்பட்ட பகுதி *</span>
              <span lang="en" className="text-xs">Assigned area *</span>
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
              <span lang="ta" className="text-xs text-muted">விளக்கம் (தமிழ்)</span>
              <span lang="en" className="text-xs">Description (Tamil)</span>
              <textarea
                name="descriptionTa"
                rows={3}
                maxLength={4000}
                placeholder="நிகழ்வின் நோக்கம் மற்றும் விவரங்கள்..."
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">விளக்கம் (ஆங்கிலம்)</span>
              <span lang="en" className="text-xs">Description (English)</span>
              <textarea
                name="descriptionEn"
                rows={3}
                maxLength={4000}
                placeholder="Purpose and details of the event..."
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-schedule" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-schedule" className="text-base font-bold">
            <span lang="ta" className="block text-xs font-semibold text-muted">2. நேர அட்டவணை மற்றும் வருகைப் பதிவு</span>
            <span lang="en">2. Schedule and check-in</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">ஆரம்ப நேரம் (இலங்கை நேரம்) *</span>
              <span lang="en" className="text-xs">Starts at (Sri Lankan time) *</span>
              <input name="startsAt" type="datetime-local" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">முடிவு நேரம் (இலங்கை நேரம்) *</span>
              <span lang="en" className="text-xs">Ends at (Sri Lankan time) *</span>
              <input name="endsAt" type="datetime-local" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">வருகைப்பதிவு திறக்கும் நேரம் (விருப்பமானது)</span>
              <span lang="en" className="text-xs">Check-in opens at (optional)</span>
              <input name="checkinOpensAt" type="datetime-local" className="min-h-11 rounded-lg border border-line px-3" />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">வருகைப்பதிவு முடிவடையும் நேரம் (விருப்பமானது)</span>
              <span lang="en" className="text-xs">Check-in closes at (optional)</span>
              <input name="checkinClosesAt" type="datetime-local" className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-venue" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-venue" className="text-base font-bold">
            <span lang="ta" className="block text-xs font-semibold text-muted">3. நிகழ்விடம் மற்றும் அணுகல்தன்மை</span>
            <span lang="en">3. Venue and access</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">நிகழ்விடம் மற்றும் முகவரி *</span>
              <span lang="en" className="text-xs">Venue name and address *</span>
              <input
                name="venue"
                required
                maxLength={300}
                placeholder="e.g. Town Hall Community Centre, Main Street"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">சந்திக்கும் இடம்</span>
              <span lang="en" className="text-xs">Meeting point</span>
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
              <span lang="ta" className="text-xs text-muted">அணுகல்தன்மைத் தகவல்</span>
              <span lang="en" className="text-xs">Accessibility information</span>
              <input
                name="accessibility"
                maxLength={1000}
                placeholder="e.g. Wheelchair accessible entrance and seating available"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang="ta" className="text-xs text-muted">தொடர்பு வழி</span>
              <span lang="en" className="text-xs">Contact route</span>
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
              <span lang="ta" className="text-xs text-muted">பங்கேற்பாளர் எல்லை (விருப்பமானது)</span>
              <span lang="en" className="text-xs">Capacity limit (optional)</span>
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
                <span>
                  <span lang="ta" className="block text-xs font-semibold text-text">நிலுவையிலுள்ள உறுப்பினர்களை அனுமதிக்குக</span>
                  <span lang="en" className="block text-xs text-muted">Admit pending members (passes issued to unverified / pending)</span>
                </span>
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/events" className="min-h-11 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-surface">
            <span className="flex flex-col items-center">
              <span lang="ta">ரத்துசெய்க</span>
              <span lang="en" className="text-xs font-normal">Cancel</span>
            </span>
          </Link>
          <SubmitButton tone="primary">
            <span className="flex flex-col items-center">
              <span lang="ta">வரைவு நிகழ்வைச் சேமிக்குக</span>
              <span lang="en" className="text-xs font-normal opacity-90">Save draft event</span>
            </span>
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
