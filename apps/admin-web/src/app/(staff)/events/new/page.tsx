import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createEvent } from '@/features/events/actions';
import { getAdminLocale } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

const EVENT_TYPES = [
  { value: 'community_meeting', ta: 'சமூகக் கூட்டம்', en: 'Community meeting' },
  { value: 'service_day', ta: 'சேவை நாள்', en: 'Service day' },
  { value: 'training', ta: 'பயிற்சி', en: 'Training' },
  { value: 'cultural', ta: 'கலாச்சார நிகழ்வு', en: 'Cultural' },
  { value: 'town_hall', ta: 'மக்கள் மன்றம்', en: 'Town hall' },
  { value: 'other', ta: 'ஏனையவை', en: 'Other' },
] as const;

export default function NewEventPage(props: PageProps<'/events/new'>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/events" className="text-sm font-semibold text-primary underline">
          ← Back to events
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
  const locale = await getAdminLocale(staff.member.language);
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
          <h2 id="section-basic" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '1. நிகழ்வு விவரங்கள்' : '1. Event details'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (தமிழ்) *' : 'Title (Tamil) *'}</span>
              <input
                name="titleTa"
                required
                maxLength={160}
                placeholder={locale === 'ta' ? 'எ.கா. யாழ்ப்பாண நகர சமூகக் கூட்டம்' : 'e.g. Jaffna Town Community Meeting'}
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (ஆங்கிலம்) *' : 'Title (English) *'}</span>
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
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'நிகழ்வு வகை *' : 'Event type *'}</span>
              <select name="eventType" required defaultValue="community_meeting" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t[locale]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'ஒதுக்கப்பட்ட பகுதி *' : 'Assigned area *'}</span>
              <select name="areaSelection" required className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {managedAssignments.map((a) => {
                  const label = a.area.level === 'platform' ? (locale === 'ta' ? 'தேசிய தளம்' : 'Platform wide') : `${a.area.level} ${a.area.code}`;
                  const value = `${a.area.level}:${a.area.code ?? ''}`;
                  return (
                    <option key={a.id} value={value}>
                      {label} ({locale === 'ta' ? 'நிலை' : 'Tier'} {a.tier})
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'விளக்கம் (தமிழ்)' : 'Description (Tamil)'}</span>
              <textarea
                name="descriptionTa"
                rows={3}
                maxLength={4000}
                placeholder={locale === 'ta' ? 'நிகழ்வின் நோக்கம் மற்றும் விவரங்கள்...' : 'Purpose and details of the event in Tamil...'}
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'விளக்கம் (ஆங்கிலம்)' : 'Description (English)'}</span>
              <textarea
                name="descriptionEn"
                rows={3}
                maxLength={4000}
                placeholder="Purpose and details of the event in English..."
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-schedule" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-schedule" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '2. நேர அட்டவணை மற்றும் வருகைப் பதிவு' : '2. Schedule and check-in'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'ஆரம்ப நேரம் (இலங்கை நேரம்) *' : 'Starts at (Sri Lankan time) *'}</span>
              <input name="startsAt" type="datetime-local" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'முடிவு நேரம் (இலங்கை நேரம்) *' : 'Ends at (Sri Lankan time) *'}</span>
              <input name="endsAt" type="datetime-local" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'வருகைப்பதிவு திறக்கும் நேரம் (விருப்பமானது)' : 'Check-in opens at (optional)'}</span>
              <input name="checkinOpensAt" type="datetime-local" className="min-h-11 rounded-lg border border-line px-3" />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'வருகைப்பதிவு முடிவடையும் நேரம் (விருப்பமானது)' : 'Check-in closes at (optional)'}</span>
              <input name="checkinClosesAt" type="datetime-local" className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-venue" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-venue" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '3. நிகழ்விடம் மற்றும் அணுகல்தன்மை' : '3. Venue and access'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'நிகழ்விடம் மற்றும் முகவரி *' : 'Venue name and address *'}</span>
              <input
                name="venue"
                required
                maxLength={300}
                placeholder="e.g. Town Hall Community Centre, Main Street"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'சந்திக்கும் இடம்' : 'Meeting point'}</span>
              <input
                name="meetingPoint"
                maxLength={300}
                placeholder="e.g. North gate registration desk"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-text sm:col-span-2">
              <span lang={locale}>{locale === 'ta' ? 'நிகழ்ச்சி நிரல்' : 'Agenda'}</span>
              <textarea
                name="agenda"
                maxLength={4000}
                rows={4}
                className="rounded-lg border border-line px-3 py-2"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'அணுகல்தன்மைத் தகவல்' : 'Accessibility information'}</span>
              <input
                name="accessibility"
                maxLength={1000}
                placeholder="e.g. Wheelchair accessible entrance and seating available"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'தொடர்பு வழி' : 'Contact route'}</span>
              <input
                name="contactRoute"
                maxLength={300}
                placeholder="e.g. events@northunity.lk"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-text">
              <span lang={locale}>{locale === 'ta' ? 'பங்கேற்பாளர் எல்லை (விருப்பமானது)' : 'Capacity limit (optional)'}</span>
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
                <span lang={locale} className="font-semibold text-text">
                  {locale === 'ta'
                    ? 'நிலுவையிலுள்ள உறுப்பினர்களை அனுமதிக்குக (அடையாளம் சரிபார்க்கப்படாதவர்களுக்கும் அட்டை வழங்கப்படும்)'
                    : 'Admit pending members (passes issued to unverified / pending)'}
                </span>
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/events" className="min-h-11 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-surface">
            <span lang={locale}>{locale === 'ta' ? 'ரத்துசெய்க' : 'Cancel'}</span>
          </Link>
          <SubmitButton tone="primary">
            <span lang={locale}>{locale === 'ta' ? 'வரைவு நிகழ்வைச் சேமிக்குக' : 'Save draft event'}</span>
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
