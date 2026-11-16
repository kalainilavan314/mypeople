import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
const NO_STORE = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

/** Keep the API token server-side while the audited API exports an area-scoped roster. */
export async function GET(_request: NextRequest, { params }: RouteContext<'/events/[id]/attendance.csv'>) {
  const { id } = await params;
  const token = await readStaffToken();
  if (!token || !API_URL || !UUID.test(id)) {
    return new Response('Not available', { status: 404, headers: NO_STORE });
  }

  const csv = await fetch(`${API_URL}/v1/events/manage/${encodeURIComponent(id)}/attendance.csv`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!csv.ok || !csv.body) {
    return new Response('Not available', { status: csv.status || 502, headers: NO_STORE });
  }

  return new Response(csv.body, {
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': csv.headers.get('Content-Disposition') ?? 'attachment; filename="attendance.csv"',
    },
  });
}
