import type { ManagedEvent } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { ConsolePagination } from '@/components/ConsolePagination';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime } from '@/lib/format';
import { loadAreaNames } from '@/lib/areas';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { CONSOLE_PAGE_SIZE, consolePage } from '@/lib/pagination';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

type EventStateFilter = 'draft' | 'published' | 'cancelled';
const STATES: EventStateFilter[] = ['draft', 'published', 'cancelled'];
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function EventsConsolePage(props: PageProps<'/events'>) {
  return (
    <>
      <PageHeader ta="நிகழ்வுகள் மேலாண்மை" en="Event console">
        <Link
          href="/events/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90">
          + Create event
        </Link>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading />}>
        <EventsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function EventsContent({ searchParams }: { searchParams: PageProps<'/events'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const params = await searchParams;
  const state = one(params.state) as EventStateFilter | undefined;
  const error = one(params.error);
  const problems = one(params.problems);
  const done = one(params.done);
  const page = consolePage(params.page);

  const api = await staffApi();
  let events: ManagedEvent[] = [];
  try {
    const statesToFilter = state && STATES.includes(state) ? [state] : undefined;
    events = await api.listManagedEvents({ states: statesToFilter, limit: CONSOLE_PAGE_SIZE + 1, offset: (page - 1) * CONSOLE_PAGE_SIZE });
  } catch (err) {
    if (isRefusal(err)) return <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>;
    throw err;
  }

  const hasMore = events.length > CONSOLE_PAGE_SIZE;
  events = events.slice(0, CONSOLE_PAGE_SIZE);
  const areaNames = await loadAreaNames(events.map((event) => event.areaKey));
  const draftCount = events.filter((e) => e.state === 'draft').length;
  const publishedCount = events.filter((e) => e.state === 'published').length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>
          {locale === 'ta'
            ? `${publishedCount} வெளியிடப்பட்டவை · ${draftCount} வரைவில்`
            : `${publishedCount} published · ${draftCount} in draft on this page`}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'நிலை வடிகட்டி' : 'Status filter'}</span>
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="">{locale === 'ta' ? 'அனைத்து நிலைகளும் (வரைவுகள் மற்றும் வெளியிடப்பட்டவை)' : 'All active states (drafts and published)'}</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          <span lang={locale}>{locale === 'ta' ? 'வடிகட்டுக' : 'Filter'}</span>
        </button>
      </form>

      {events.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          <span lang={locale}>{locale === 'ta' ? 'உங்கள் பகுதிக்கு எந்த நிகழ்வுகளும் காணப்படவில்லை.' : 'No events found for your area and filter.'}</span>
        </div>
      ) : null}

      <div hidden={events.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Managed events list</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'குறிப்பு எண்' : 'Reference'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'நிலை' : 'Status'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'தலைப்பு' : 'Title'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'வகை' : 'Type'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'பகுதி' : 'Area'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'ஆரம்ப நேரம்' : 'Starts'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'வருகைப்பதிவுகள்' : 'RSVPs'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-surface/50">
                <td className="px-3 py-2">
                  <Link href={`/events/${event.id}`} className="font-mono font-semibold text-primary underline">
                    {event.eventRef}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StateTag state={event.state} />
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-text">{locale === 'ta' ? event.titleTa || event.titleEn : event.titleEn || event.titleTa}</p>
                </td>
                <td className="px-3 py-2 capitalize">{event.eventType.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2"><span lang={locale}>{areaText(event.areaKey, areaNames, locale)}</span></td>
                <td className="px-3 py-2">{formatDateTime(event.startsAt)}</td>
                <td className="px-3 py-2 text-muted">
                  {event.going} {event.capacity ? `/ ${event.capacity}` : (locale === 'ta' ? 'பதிவானவர்கள்' : 'going')}
                  {event.waitlisted > 0 ? ` (${event.waitlisted} ${locale === 'ta' ? 'காத்திருப்போர்' : 'waitlist'})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConsolePagination pathname="/events" page={page} hasMore={hasMore} filters={{ state: state && STATES.includes(state) ? state : undefined }} />
    </>
  );
}
