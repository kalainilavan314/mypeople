import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken, staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
const NO_STORE = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await readStaffToken();
  if (!token || !API_URL || !UUID.test(id)) {
    return new Response('Not available', { status: 404, headers: NO_STORE });
  }

  try {
    const api = await staffApi();
    const slipView = await api.getFinanceSlipViewToken(id);

    const image = await fetch(`${API_URL}/v1/finance/slips/${encodeURIComponent(slipView.token)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!image.ok || !image.body) {
      return new Response('Slip image not available', { status: image.status || 502, headers: NO_STORE });
    }

    return new Response(image.body, {
      headers: {
        'Content-Type': image.headers.get('Content-Type') ?? 'image/jpeg',
        'Content-Disposition': 'inline',
        ...NO_STORE,
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; sandbox",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new Response('Refused: slip access unavailable', { status: 403, headers: NO_STORE });
  }
}
