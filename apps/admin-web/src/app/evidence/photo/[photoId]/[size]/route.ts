import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
const SIZES = new Set(['thumb', 'display']);
const NO_STORE = { 'Cache-Control': 'no-store, private' };

/**
 * Opens one gallery photo safely for a signed-in staff reviewer (D08, BRD FR-GAL-006).
 * Proxies the API photo stream directly with authenticated staff token, no-store, nosniff,
 * and CSP sandbox. Unauthenticated or public requests are refused.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<'/evidence/photo/[photoId]/[size]'>,
) {
  const { photoId, size } = await params;
  const token = await readStaffToken();

  if (!token || !API_URL || !UUID.test(photoId) || !SIZES.has(size)) {
    return new Response('Not available', { status: 404, headers: NO_STORE });
  }

  const url = `${API_URL}/v1/content/photos/${encodeURIComponent(photoId)}/${encodeURIComponent(size)}`;
  const image = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!image.ok || !image.body) {
    return new Response('Not available', { status: image.status || 502, headers: NO_STORE });
  }

  return new Response(image.body, {
    headers: {
      'Content-Type': image.headers.get('Content-Type') ?? 'image/webp',
      'Content-Disposition': 'inline',
      ...NO_STORE,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; sandbox",
      'Referrer-Policy': 'no-referrer',
    },
  });
}
