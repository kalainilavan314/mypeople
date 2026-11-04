import { connection } from 'next/server';

import { api } from '@/lib/api';
import { getAdminLocale, type Locale } from '@/lib/i18n';

type Check = { name: string; ok: boolean; result: string };

async function runCheck(name: string, check: () => Promise<unknown>, okText: string, failText: string): Promise<Check> {
  try {
    await check();
    return { name, ok: true, result: okText };
  } catch {
    return { name, ok: false, result: failText };
  }
}

/** Live API and database health, read on the server for every request. */
export async function SystemStatus({ locale: propLocale }: { locale?: Locale } = {}) {
  // Always at request time: the result must never be frozen into the page at
  // build time, even when API_URL is only set on the running server.
  await connection();
  const locale = propLocale ?? (await getAdminLocale());

  if (!api) {
    return (
      <p className="text-error">
        ! {locale === 'ta' ? 'API_URL அமைக்கப்படவில்லை, முகப்பலகையால் API-ஐ அணுக முடியவில்லை.' : 'API_URL is not set, so the dashboard cannot reach the API.'}
      </p>
    );
  }

  const checks = await Promise.all([
    runCheck(
      locale === 'ta' ? 'பயன்பாட்டு இடைமுகம் (API)' : 'API',
      api.checkHealth,
      locale === 'ta' ? 'இயங்குகிறது' : 'Running',
      locale === 'ta' ? 'இணைக்க முடியவில்லை' : 'Unreachable'
    ),
    runCheck(
      locale === 'ta' ? 'தரவுத்தளம் (Database)' : 'Database',
      api.checkDatabase,
      locale === 'ta' ? 'இணைக்கப்பட்டுள்ளது' : 'Reachable',
      locale === 'ta' ? 'கிடைக்கவில்லை' : 'Unavailable'
    ),
  ]);

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-card">
      {checks.map((check) => (
        <li key={check.name} className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
          <span className="text-sm font-medium text-text">{check.name}</span>
          <span className={`text-sm font-medium ${check.ok ? 'text-success' : 'text-error'}`}>
            {check.result}
          </span>
        </li>
      ))}
    </ul>
  );
}
