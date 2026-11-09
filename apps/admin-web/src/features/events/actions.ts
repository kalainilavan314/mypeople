'use server';

import type { AreaLevel, EventCreateInput, EventType, EventUpdateInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { parseSriLankaDateTime } from '@/lib/format';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function back(path: string, query: string): never {
  redirect(`${path}?${query}`);
}

function eventRefused(eventId: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(`/events/${eventId}`, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function newEventRefused(error: unknown): never {
  const { code, problems } = failure(error);
  back('/events/new', `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

/** Create a new draft event in the staff member's managed area. */
export async function createEvent(formData: FormData): Promise<void> {
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleTa = String(formData.get('titleTa') ?? '').trim();
  const descriptionEn = String(formData.get('descriptionEn') ?? '').trim();
  const descriptionTa = String(formData.get('descriptionTa') ?? '').trim();
  const eventType = String(formData.get('eventType') ?? 'community_meeting') as EventType;
  const areaSelection = String(formData.get('areaSelection') ?? '');
  let areaLevel: AreaLevel = 'district';
  let areaCode: string | null = null;
  if (areaSelection.includes(':')) {
    const [lvl, code] = areaSelection.split(':', 2);
    areaLevel = lvl as AreaLevel;
    areaCode = code ? code.trim() : null;
  } else {
    areaLevel = String(formData.get('areaLevel') ?? 'district') as AreaLevel;
    areaCode = String(formData.get('areaCode') ?? '').trim() || null;
  }
  const venue = String(formData.get('venue') ?? '').trim();
  const meetingPoint = String(formData.get('meetingPoint') ?? '').trim();
  const agenda = String(formData.get('agenda') ?? '').trim();
  const accessibility = String(formData.get('accessibility') ?? '').trim();
  const contactRoute = String(formData.get('contactRoute') ?? '').trim();

  const startsAt = parseSriLankaDateTime(formData.get('startsAt') as string | null);
  const endsAt = parseSriLankaDateTime(formData.get('endsAt') as string | null);
  const checkinOpensAt = parseSriLankaDateTime(formData.get('checkinOpensAt') as string | null);
  const checkinClosesAt = parseSriLankaDateTime(formData.get('checkinClosesAt') as string | null);

  const capacityRaw = String(formData.get('capacity') ?? '').trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const admitsPending = formData.get('admitsPending') === '1';

  if (!titleEn || !titleTa || !venue || !startsAt || !endsAt) {
    back('/events/new', 'error=event_invalid&problems=required_fields_missing');
  }

  const input: EventCreateInput = {
    titleEn,
    titleTa,
    descriptionEn,
    descriptionTa,
    eventType,
    startsAt,
    endsAt,
    checkinOpensAt: checkinOpensAt || undefined,
    checkinClosesAt: checkinClosesAt || undefined,
    venue,
    meetingPoint,
    agenda,
    accessibility,
    contactRoute,
    capacity: capacity && capacity > 0 ? capacity : undefined,
    admitsPending,
    area: {
      level: areaLevel,
      code: areaLevel === 'platform' ? null : areaCode,
    },
  };

  let createdId: string;
  try {
    const api = await staffApi();
    const event = await api.createEvent(input);
    createdId = event.id;
  } catch (error) {
    newEventRefused(error);
  }

  redirect(`/events/${createdId}?done=event_created`);
}

/** Update an existing draft or published event. */
export async function updateEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '');
  if (!UUID.test(eventId)) redirect('/events');

  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleTa = String(formData.get('titleTa') ?? '').trim();
  const descriptionEn = String(formData.get('descriptionEn') ?? '').trim();
  const descriptionTa = String(formData.get('descriptionTa') ?? '').trim();
  const eventType = String(formData.get('eventType') ?? '') as EventType;
  const venue = String(formData.get('venue') ?? '').trim();
  const meetingPoint = String(formData.get('meetingPoint') ?? '').trim();
  const agenda = String(formData.get('agenda') ?? '').trim();
  const accessibility = String(formData.get('accessibility') ?? '').trim();
  const contactRoute = String(formData.get('contactRoute') ?? '').trim();

  const startsAt = parseSriLankaDateTime(formData.get('startsAt') as string | null);
  const endsAt = parseSriLankaDateTime(formData.get('endsAt') as string | null);
  const checkinOpensAt = parseSriLankaDateTime(formData.get('checkinOpensAt') as string | null);
  const checkinClosesAt = parseSriLankaDateTime(formData.get('checkinClosesAt') as string | null);

  const capacityRaw = String(formData.get('capacity') ?? '').trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const admitsPending = formData.has('admitsPending') ? formData.get('admitsPending') === '1' : undefined;

  const input: EventUpdateInput = {
    titleEn: titleEn || undefined,
    titleTa: titleTa || undefined,
    descriptionEn,
    descriptionTa,
    eventType: eventType || undefined,
    venue: venue || undefined,
    meetingPoint,
    agenda,
    accessibility,
    contactRoute,
    startsAt: startsAt || undefined,
    endsAt: endsAt || undefined,
    checkinOpensAt: checkinOpensAt || undefined,
    checkinClosesAt: checkinClosesAt || undefined,
    capacity,
    admitsPending,
  };

  try {
    const api = await staffApi();
    await api.updateEvent(eventId, input);
  } catch (error) {
    eventRefused(eventId, error);
  }

  back(`/events/${eventId}`, 'done=event_updated');
}

/** Publish a draft event with explicit confirmation. */
export async function publishEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '');
  if (!UUID.test(eventId)) redirect('/events');

  const confirmed = formData.get('confirmPublish') === '1';
  if (!confirmed) {
    back(`/events/${eventId}`, 'error=event_invalid&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.publishEvent(eventId);
  } catch (error) {
    eventRefused(eventId, error);
  }

  back(`/events/${eventId}`, 'done=event_published');
}

/** Cancel a published or draft event with a required reason. */
export async function cancelEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '');
  if (!UUID.test(eventId)) redirect('/events');

  const reason = String(formData.get('reason') ?? '').trim();
  const confirmed = formData.get('confirmCancel') === '1';

  if (!reason || reason.length < 3) {
    back(`/events/${eventId}`, 'error=event_invalid&problems=reason_required');
  }
  if (!confirmed) {
    back(`/events/${eventId}`, 'error=event_invalid&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.cancelEvent(eventId, reason);
  } catch (error) {
    eventRefused(eventId, error);
  }

  back(`/events/${eventId}`, 'done=event_cancelled');
}

/**
 * Settle an offline scan that waits for a person (MP-DEC-001 4.5; needs events.manage, never the
 * person who scanned it). Accepting still needs a genuine pass as at the recorded time, which the
 * API checks. Only codes go back in the address, never the reason typed.
 */
export async function decideOfflineScan(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '');
  const scanId = String(formData.get('scanId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(eventId)) redirect('/events');
  const page = `/events/${eventId}/offline-scans`;
  if (!UUID.test(scanId) || (decision !== 'accepted' && decision !== 'rejected')) back(page, 'error=invalid_request');
  if (reason.length < 3 || reason.length > 1000) back(page, 'error=reason_required');
  try {
    await (await staffApi()).decideScanException(scanId, decision as 'accepted' | 'rejected', reason);
  } catch (error) {
    const { code } = failure(error);
    back(page, `error=${encodeURIComponent(code)}`);
  }
  back(page, `done=scan_${decision}`);
}
