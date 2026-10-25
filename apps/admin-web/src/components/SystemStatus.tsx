import { connection } from 'next/server';

import { api } from '@/lib/api';

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
export async function SystemStatus() {
  // Always at request time: the result must never be frozen into the page at
  // build time, even when API_URL is only set on the running server.
  await connection();
  if (!api) {
    return <p className="text-error">! API_URL is not set, so the dashboard cannot reach the API.</p>;
  }

  const checks = await Promise.all([
    runCheck('API', api.checkHealth, 'Running', 'Unreachable'),
    runCheck('Database', api.checkDatabase, 'Reachable', 'Unavailable'),
  ]);

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-card">
      {checks.map((check) => (
        <li key={check.name} className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">{check.name}</span>
          {/* Symbol and words, never colour alone. */}
          <span className={check.ok ? 'text-success' : 'text-error'}>
            {check.ok ? '✓' : '!'} {check.result}
          </span>
        </li>
      ))}
    </ul>
  );
}
