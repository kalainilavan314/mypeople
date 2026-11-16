import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

export async function GET(request: NextRequest) {
  const token = await readStaffToken();
  if (!token || !API_URL) {
    return new Response('Not authorized', { status: 401, headers: NO_STORE });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const res = await fetch(`${API_URL}/v1/finance/ledger.csv?month=${encodeURIComponent(month)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/csv',
    },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) {
    return new Response('Export failed', { status: res.status || 502, headers: NO_STORE });
  }

  return new Response(res.body, {
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finance-ledger-${month}.csv"`,
    },
  });
}
