import type { ManagedEvent } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

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
          <span className="flex flex-col items-center">
            <span lang="ta">+ புதிய நிகழ்வு</span>
            <span lang="en" className="text-xs font-normal opacity-90">+ Create event</span>
          </span>
        </Link>
      </PageHeader>
      <Suspense fallback={<p className="text-muted">… Loading events</p>}>
        <EventsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function EventsContent({ searchParams }: { searchParams: PageProps<'/events'>['searchParams'] }) {
  const params = await searchParams;
  const state = one(params.state) as EventStateFilter | undefined;
  const error = one(params.error);
  const problems = one(params.problems);
  const done = one(params.done);

  const api = await staffApi();
  let events: ManagedEvent[] = [];
  try {
    const statesToFilter = state && STATES.includes(state) ? [state] : undefined;
    events = await api.listManagedEvents({ states: statesToFilter, limit: 100 });
  } catch (err) {
    if (isRefusal(err)) return <p className="text-error">! {messageFor(err.code)}</p>;
    throw err;
  }

  const draftCount = events.filter((e) => e.state === 'draft').length;
  const publishedCount = events.filter((e) => e.state === 'published').length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>
          {publishedCount} published · {draftCount} in draft
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Status filter
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="">All active states (drafts and published)</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Filter
        </button>
      </form>

      {events.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          No events found for your area and filter.
        </div>
      ) : null}

      <div hidden={events.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Managed events list</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Reference</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Title</th>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2">Area</th>
              <th scope="col" className="px-3 py-2">Starts</th>
              <th scope="col" className="px-3 py-2">RSVPs</th>
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
                  <p className="font-medium">{event.titleEn}</p>
                  <p lang="ta" className="text-xs text-muted">
                    {event.titleTa}
                  </p>
                </td>
                <td className="px-3 py-2 capitalize">{event.eventType.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2">{areaText(event.areaKey)}</td>
                <td className="px-3 py-2">{formatDateTime(event.startsAt)}</td>
                <td className="px-3 py-2 text-muted">
                  {event.going} {event.capacity ? `/ ${event.capacity}` : 'going'}
                  {event.waitlisted > 0 ? ` (${event.waitlisted} waitlist)` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
