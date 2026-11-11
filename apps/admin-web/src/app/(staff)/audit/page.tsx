import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { areaText, formatDateTime } from '@/lib/format';
import { loadAreaNames } from '@/lib/areas';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The append-only, hash-chained audit log, newest first, limited
 * to the auditor's region; platform auditors can check the chain. Entries
 * hold ids and codes only.
 */
export default function AuditPage(props: PageProps<'/audit'>) {
  return (
    <>
      <PageHeader ta="தணிக்கைப் பதிவு" en="Audit log" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Audit searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<'/audit'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const action = one(query.action)?.trim() || undefined;
  const beforeId = Number(one(query.before)) || undefined;
  const api = await staffApi();
  let entries;
  try {
    entries = await api.listAuditEntries({ action, beforeId, limit: 50 });
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  const platform = staff.assignments.some((a) => a.area.level === 'platform' && a.permissions.includes('audit.view'));
  const chain = platform && one(query.verify) === '1' ? await api.verifyAuditChain() : null;
  const last = entries.at(-1);
  const areaNames = await loadAreaNames(entries.map((entry) => (entry.areaLevel ? { level: entry.areaLevel, code: entry.areaCode } : null)));

  return (
    <>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale} className="text-xs">{locale === 'ta' ? 'செயல்முறை' : 'Action'}</span>
          <input name="action" defaultValue={action} placeholder="identity.review.decided" className="min-h-11 rounded-lg border border-line px-3 font-mono" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          <span lang={locale}>{locale === 'ta' ? 'காட்டுக' : 'Filter'}</span>
        </button>
        {platform ? (
          <button type="submit" name="verify" value="1" className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-primary">
            <span lang={locale}>{locale === 'ta' ? 'தணிக்கைச் சங்கிலியைச் சரிபார்' : 'Check the hash chain'}</span>
          </button>
        ) : null}
      </form>
      {chain ? (
        <p role="status" className={chain.ok ? 'text-success font-semibold text-sm' : 'text-error font-semibold text-sm'}>
          {chain.ok
            ? locale === 'ta'
              ? `தணிக்கைச் சங்கிலி ஒருமைப்பாடு உறுதிசெய்யப்பட்டது: ${chain.checked} பதிவுகள் சரிபார்க்கப்பட்டன.`
              : `Chain intact: ${chain.checked} entries checked.`
            : locale === 'ta'
              ? `! பதிவு ${chain.firstBrokenId} இல் சங்கிலி முறிந்துள்ளது.`
              : `! Chain broken at entry ${chain.firstBrokenId}.`}
        </p>
      ) : null}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 text-center text-muted">
          <p lang={locale} className="text-sm font-semibold">
            {locale === 'ta' ? 'தணிக்கைப் பதிவுகள் எதுவும் காணப்படவில்லை' : 'No audit log entries found matching this filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit entries</caption>
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">#</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  <span lang={locale}>{locale === 'ta' ? 'நேரம்' : 'When'}</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  <span lang={locale}>{locale === 'ta' ? 'செயல்முறை' : 'Action'}</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  <span lang={locale}>{locale === 'ta' ? 'இலக்கு' : 'Target'}</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  <span lang={locale}>{locale === 'ta' ? 'பகுதி' : 'Area'}</span>
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  <span lang={locale}>{locale === 'ta' ? 'விவரங்கள்' : 'Details'}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2 font-mono">{entry.id}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(entry.occurredAt)}</td>
                  <td className="px-3 py-2 font-mono">{entry.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.targetType ? `${entry.targetType} ${entry.targetId ?? ''}` : '—'}</td>
                  <td className="px-3 py-2">{entry.areaLevel ? areaText({ level: entry.areaLevel, code: entry.areaCode }, areaNames, locale) : '—'}</td>
                  <td className="px-3 py-2">
                    <AuditDetails details={entry.details as Record<string, unknown> | null | undefined} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        {beforeId ? (
          <a href={`/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`} className="text-primary underline">
            <span lang={locale}>{locale === 'ta' ? '← முதற் பக்கம் (சமீபத்தியவை)' : '← First page (newest)'}</span>
          </a>
        ) : (
          <span />
        )}
        {last && entries.length === 50 ? (
          <a href={`/audit?before=${last.id}${action ? `&action=${encodeURIComponent(action)}` : ''}`} className="text-primary underline">
            <span lang={locale}>{locale === 'ta' ? 'முந்தைய பதிவுகள் →' : 'Older entries →'}</span>
          </a>
        ) : null}
      </div>
    </>
  );
}

function AuditDetails({ details }: { details?: Record<string, unknown> | null }) {
  if (!details || Object.keys(details).length === 0) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(details).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px]">
          <span className="text-muted">{k}:</span>
          <span className="font-semibold text-text">{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  );
}
