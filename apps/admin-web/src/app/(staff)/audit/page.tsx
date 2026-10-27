import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { areaText, formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * FR-ADM-011: the append-only, hash-chained audit log, newest first, limited
 * to the auditor's region; platform auditors can check the chain. Entries
 * hold ids and codes only.
 */
export default function AuditPage(props: PageProps<'/audit'>) {
  return (
    <>
      <PageHeader ta="தணிக்கைப் பதிவு" en="Audit log" brd="FR-ADM-011, PRM-25" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Audit searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<'/audit'>['searchParams'] }) {
  const query = await searchParams;
  const action = one(query.action)?.trim() || undefined;
  const beforeId = Number(one(query.before)) || undefined;
  const staff = await requireStaff();
  const api = await staffApi();
  let entries;
  try {
    entries = await api.listAuditEntries({ action, beforeId, limit: 50 });
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  const platform = staff.assignments.some((a) => a.area.level === 'platform' && a.permissions.includes('audit.view'));
  const chain = platform && one(query.verify) === '1' ? await api.verifyAuditChain() : null;
  const last = entries.at(-1);

  return (
    <>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Action
          <input name="action" defaultValue={action} placeholder="identity.review.decided" className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Show
        </button>
        {platform ? (
          <button type="submit" name="verify" value="1" className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-primary">
            Check the hash chain
          </button>
        ) : null}
      </form>
      {chain ? (
        <p role="status" className={chain.ok ? 'text-success' : 'text-error'}>
          {chain.ok ? `✓ Chain intact: ${chain.checked} entries checked.` : `! Chain broken at entry ${chain.firstBrokenId}.`}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Audit entries</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">#</th>
              <th scope="col" className="px-3 py-2">When</th>
              <th scope="col" className="px-3 py-2">Action</th>
              <th scope="col" className="px-3 py-2">Target</th>
              <th scope="col" className="px-3 py-2">Area</th>
              <th scope="col" className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-3 py-2 font-mono">{entry.id}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(entry.occurredAt)}</td>
                <td className="px-3 py-2 font-mono">{entry.action}</td>
                <td className="px-3 py-2 font-mono text-xs">{entry.targetType ? `${entry.targetType} ${entry.targetId ?? ''}` : '—'}</td>
                <td className="px-3 py-2">{entry.areaLevel ? areaText({ level: entry.areaLevel, code: entry.areaCode }) : '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{entry.details ? JSON.stringify(entry.details) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {last && entries.length === 50 ? (
        <a href={`/audit?before=${last.id}${action ? `&action=${encodeURIComponent(action)}` : ''}`} className="text-sm text-primary underline">
          Older entries
        </a>
      ) : null}
    </>
  );
}
