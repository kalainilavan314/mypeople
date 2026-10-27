import { ApiError } from '@my-people/api-client';
import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken, staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
// Nothing about evidence, not even a refusal, is kept by a browser or proxy.
const NO_STORE = { 'Cache-Control': 'no-store, private' };

/**
 * Opens one identity image for the signed-in reviewer (BRD FR-ARCH-007, PRM-03).
 * The API issues a 5-minute link for this reviewer alone, after the permission,
 * area and open-review checks, and logs the link and the view; this route
 * fetches it with the reviewer's session and passes the image through, never
 * stored or cached here. The session cookie is SameSite=Strict, so another site
 * cannot open evidence in a reviewer's browser.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<'/evidence/[documentId]'>) {
  const { documentId } = await params;
  const token = await readStaffToken();
  if (!token || !API_URL || !UUID.test(documentId)) return new Response('Not available', { status: 404, headers: NO_STORE });

  let url: string;
  try {
    url = (await (await staffApi()).openEvidence(documentId)).url;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    const code = error instanceof ApiError ? error.code : 'unavailable';
    return new Response(`Refused: ${code}`, { status, headers: NO_STORE });
  }

  const image = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!image.ok || !image.body) return new Response('Not available', { status: image.status || 502, headers: NO_STORE });

  return new Response(image.body, {
    headers: {
      'Content-Type': image.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      ...NO_STORE,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; sandbox",
      'Referrer-Policy': 'no-referrer',
    },
  });
}
