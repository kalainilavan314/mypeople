import type { NextRequest } from 'next/server';

import { API_URL, readStaffToken } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
// Nothing about case evidence, not even a refusal, is kept by a browser or proxy.
const NO_STORE = { 'Cache-Control': 'no-store, private' };

/**
 * Opens one case photo (the reporter's or staff evidence) for the signed-in staff member. The API
 * checks the permission and the case's area and records the view in the audit log; this route
 * passes the image through with the staff session, never stored or cached here. The session
 * cookie is SameSite=Strict, so another site cannot open evidence in a staff member's browser.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<'/evidence/case/[caseId]/[photoId]'>) {
  const { caseId, photoId } = await params;
  const token = await readStaffToken();
  if (!token || !API_URL || !UUID.test(caseId) || !UUID.test(photoId)) {
    return new Response('Not available', { status: 404, headers: NO_STORE });
  }

  const url = `${API_URL}/v1/cases/${encodeURIComponent(caseId)}/photos/${encodeURIComponent(photoId)}`;
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
