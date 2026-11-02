import type { Broadcast } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const STATES = ['draft', 'pending_approval', 'scheduled', 'sent', 'cancelled'] as const;

export default function BroadcastsListPage(props: PageProps<'/messages'>) {
  return (
    <>
      <PageHeader ta="அறிவித்தல்கள் & செய்திகள்" en="Broadcasts & messaging" brd="D09, GAP-05, FR-ADM-007">
        <Link
          href="/messages/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90">
          + Compose broadcast
        </Link>
      </PageHeader>
      <Suspense fallback={<p className="text-muted">… Loading broadcasts</p>}>
        <BroadcastsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function BroadcastsContent({ searchParams }: { searchParams: PageProps<'/messages'>['searchParams'] }) {
  const params = await searchParams;
  const state = one(params.state) as Broadcast['state'] | undefined;
  const error = one(params.error);
  const problems = one(params.problems);
  const done = one(params.done);

  const api = await staffApi();
  let broadcasts: Broadcast[] = [];

  try {
    const states = state && (STATES as readonly string[]).includes(state) ? [state] : (['draft', 'pending_approval', 'scheduled', 'sent'] as const);
    broadcasts = await api.listBroadcasts({ states, limit: 100 });
  } catch (err) {
    if (isRefusal(err)) return <p className="text-error">! {messageFor(err.code)}</p>;
    throw err;
  }

  const pendingCount = broadcasts.filter((b) => b.state === 'pending_approval').length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>{broadcasts.length} broadcasts in your area</p>
        {pendingCount > 0 ? (
          <span className="rounded bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning">
            … {pendingCount} awaiting Tier 4/5 second-person approval
          </span>
        ) : null}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          State filter
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="">All active states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Filter
        </button>
      </form>

      {broadcasts.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          No broadcasts found matching your filter.
        </div>
      ) : null}

      <div hidden={broadcasts.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Staff broadcasts</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Reference</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Topic</th>
              <th scope="col" className="px-3 py-2">Title</th>
              <th scope="col" className="px-3 py-2">Audience Area</th>
              <th scope="col" className="px-3 py-2">Timing</th>
              <th scope="col" className="px-3 py-2">Recipients</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {broadcasts.map((b) => (
              <tr key={b.id} className="hover:bg-surface/50">
                <td className="px-3 py-2 font-mono">
                  <Link href={`/messages/${b.id}`} className="font-semibold text-primary underline">
                    {b.broadcastRef}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StateTag state={b.state} />
                </td>
                <td className="px-3 py-2 capitalize">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      b.topic === 'emergency' ? 'bg-error-bg text-error' : 'bg-surface text-muted'
                    }`}>
                    {b.topic}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{b.titleEn}</p>
                  <p lang="ta" className="text-xs text-muted">
                    {b.titleTa}
                  </p>
                </td>
                <td className="px-3 py-2">{areaText(b.areaKey)}</td>
                <td className="px-3 py-2 text-muted text-xs">
                  {b.sentAt ? `Sent ${formatDateTime(b.sentAt)}` : b.sendAt ? `Scheduled ${formatDateTime(b.sendAt)}` : 'Draft'}
                </td>
                <td className="px-3 py-2 font-medium">{b.recipients !== null ? b.recipients.toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
