'use server';

import type { AreaLevel, BroadcastCreateInput, BroadcastUpdateInput, StaffTier } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { parseSriLankaDateTime } from '@/lib/format';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;
// Pattern check for Sri Lankan NIC numbers (old: 9 digits + v/x, new: 12 digits)
const NIC_PATTERN = /\b(?:\d{9}[vVxX]|\d{12})\b/;
const STAFF_TIERS = new Set<StaffTier>(['1', '2A', '2B', '3A', '3B', '4', '5']);

function back(path: string, query: string): never {
  redirect(`${path}?${query}`);
}

function broadcastRefused(broadcastId: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(`/messages/${broadcastId}`, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function newBroadcastRefused(error: unknown): never {
  const { code, problems } = failure(error);
  back('/messages/new', `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function containsSensitiveData(text: string): boolean {
  return NIC_PATTERN.test(text);
}

export async function createBroadcast(formData: FormData): Promise<void> {
  const topic = String(formData.get('topic') ?? 'announcements') as 'announcements' | 'emergency';
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleTa = String(formData.get('titleTa') ?? '').trim();
  const bodyEn = String(formData.get('bodyEn') ?? '').trim();
  const bodyTa = String(formData.get('bodyTa') ?? '').trim();

  const areaSelection = String(formData.get('areaSelection') ?? '');
  const rawAudienceTier = String(formData.get('audienceTier') ?? 'all');
  const audienceTier = STAFF_TIERS.has(rawAudienceTier as StaffTier) ? rawAudienceTier as StaffTier : null;
  let areaLevel: AreaLevel = 'district';
  let areaCode: string | null = null;
  if (areaSelection.includes(':')) {
    const [lvl, code] = areaSelection.split(':', 2);
    areaLevel = lvl as AreaLevel;
    areaCode = code ? code.trim() : null;
  }

  if (!titleEn || !titleTa || !bodyEn || !bodyTa) {
    back('/messages/new', 'error=broadcast_invalid&problems=required_fields_missing');
  }

  if (
    containsSensitiveData(titleEn) ||
    containsSensitiveData(titleTa) ||
    containsSensitiveData(bodyEn) ||
    containsSensitiveData(bodyTa)
  ) {
    back('/messages/new', 'error=broadcast_invalid&problems=contains_id_number');
  }

  const input: BroadcastCreateInput = {
    topic,
    titleEn,
    titleTa,
    bodyEn,
    bodyTa,
    area: {
      level: areaLevel,
      code: areaLevel === 'platform' ? null : areaCode,
    },
    audienceTiers: audienceTier ? [audienceTier] : null,
  };

  let createdId: string;
  try {
    const api = await staffApi();
    const broadcast = await api.createBroadcast(input);
    createdId = broadcast.id;
  } catch (error) {
    newBroadcastRefused(error);
  }

  redirect(`/messages/${createdId}?done=broadcast_created`);
}

export async function updateBroadcast(formData: FormData): Promise<void> {
  const broadcastId = String(formData.get('broadcastId') ?? '');
  if (!UUID.test(broadcastId)) redirect('/messages');

  const topic = String(formData.get('topic') ?? '') as 'announcements' | 'emergency';
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleTa = String(formData.get('titleTa') ?? '').trim();
  const bodyEn = String(formData.get('bodyEn') ?? '').trim();
  const bodyTa = String(formData.get('bodyTa') ?? '').trim();

  if (
    containsSensitiveData(titleEn) ||
    containsSensitiveData(titleTa) ||
    containsSensitiveData(bodyEn) ||
    containsSensitiveData(bodyTa)
  ) {
    back(`/messages/${broadcastId}`, 'error=broadcast_invalid&problems=contains_id_number');
  }

  const input: BroadcastUpdateInput = {
    topic: topic || undefined,
    titleEn: titleEn || undefined,
    titleTa: titleTa || undefined,
    bodyEn: bodyEn || undefined,
    bodyTa: bodyTa || undefined,
  };

  try {
    const api = await staffApi();
    await api.updateBroadcast(broadcastId, input);
  } catch (error) {
    broadcastRefused(broadcastId, error);
  }

  back(`/messages/${broadcastId}`, 'done=broadcast_updated');
}

export async function submitBroadcast(formData: FormData): Promise<void> {
  const broadcastId = String(formData.get('broadcastId') ?? '');
  if (!UUID.test(broadcastId)) redirect('/messages');

  const confirmed = formData.get('confirmSend') === '1';
  if (!confirmed) {
    back(`/messages/${broadcastId}`, 'error=broadcast_invalid&problems=confirmation_required');
  }

  const sendChoice = formData.get('sendChoice');
  let sendAt: string | undefined = undefined;
  if (sendChoice === 'later') {
    const scheduled = String(formData.get('sendAt') ?? '').trim();
    if (scheduled) {
      sendAt = parseSriLankaDateTime(scheduled) ?? undefined;
    }
  }

  try {
    const api = await staffApi();
    await api.submitBroadcast(broadcastId, sendAt);
  } catch (error) {
    broadcastRefused(broadcastId, error);
  }

  back(`/messages/${broadcastId}`, 'done=broadcast_submitted');
}

export async function approveBroadcast(formData: FormData): Promise<void> {
  const broadcastId = String(formData.get('broadcastId') ?? '');
  if (!UUID.test(broadcastId)) redirect('/messages');

  const confirmed = formData.get('confirmApprove') === '1';
  if (!confirmed) {
    back(`/messages/${broadcastId}`, 'error=broadcast_invalid&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.approveBroadcast(broadcastId);
  } catch (error) {
    broadcastRefused(broadcastId, error);
  }

  back(`/messages/${broadcastId}`, 'done=broadcast_approved');
}

export async function cancelBroadcast(formData: FormData): Promise<void> {
  const broadcastId = String(formData.get('broadcastId') ?? '');
  if (!UUID.test(broadcastId)) redirect('/messages');

  const confirmed = formData.get('confirmCancel') === '1';
  if (!confirmed) {
    back(`/messages/${broadcastId}`, 'error=broadcast_invalid&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.cancelBroadcast(broadcastId);
  } catch (error) {
    broadcastRefused(broadcastId, error);
  }

  back(`/messages/${broadcastId}`, 'done=broadcast_cancelled');
}
