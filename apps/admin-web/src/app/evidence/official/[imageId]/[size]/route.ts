import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
const SIZES = new Set(['thumb', 'display']);
const NO_STORE = { 'Cache-Control': 'no-store, private' };

/**
 * Opens an official statement's image for a signed-in publisher or Tier 5 (D30), including a draft's
 * image, which is not public until it is signed. The API checks the permission; this route passes the
 * image through with the staff session, never stored or cached here.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<'/evidence/official/[imageId]/[size]'>) {
  const { imageId, size } = await params;
  const token = await readStaffToken();
  if (!token || !API_URL || !UUID.test(imageId) || !SIZES.has(size)) {
    return new Response('Not available', { status: 404, headers: NO_STORE });
  }

  const url = `${API_URL}/v1/content/official/manage/images/${encodeURIComponent(imageId)}?size=${encodeURIComponent(size)}`;
  const image = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
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
