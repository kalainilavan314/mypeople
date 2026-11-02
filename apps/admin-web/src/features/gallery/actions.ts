'use server';

import type { AlbumCategory, AlbumCreateInput, AlbumUpdateInput, AreaLevel, GalleryImageType, RemovalDecisionInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function back(path: string, query: string): never {
  redirect(`${path}?${query}`);
}

function albumRefused(albumId: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(`/gallery/albums/${albumId}`, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function newAlbumRefused(error: unknown): never {
  const { code, problems } = failure(error);
  back('/gallery/new', `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function removalRefused(error: unknown): never {
  const { code, problems } = failure(error);
  back('/gallery?tab=removals', `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

export async function createAlbum(formData: FormData): Promise<void> {
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleTa = String(formData.get('titleTa') ?? '').trim();
  const summaryEn = String(formData.get('summaryEn') ?? '').trim();
  const summaryTa = String(formData.get('summaryTa') ?? '').trim();
  const category = String(formData.get('category') ?? 'community') as AlbumCategory;
  const place = String(formData.get('place') ?? '').trim();
  const albumDate = String(formData.get('albumDate') ?? '').trim();
  const publisher = String(formData.get('publisher') ?? '').trim();
  const eventIdRaw = String(formData.get('eventId') ?? '').trim();
  const eventId = UUID.test(eventIdRaw) ? eventIdRaw : undefined;

  const areaSelection = String(formData.get('areaSelection') ?? '');
  let areaLevel: AreaLevel = 'district';
  let areaCode: string | null = null;
  if (areaSelection.includes(':')) {
    const [lvl, code] = areaSelection.split(':', 2);
    areaLevel = lvl as AreaLevel;
    areaCode = code ? code.trim() : null;
  }

  if (!titleEn || !titleTa || !albumDate || !publisher) {
    back('/gallery/new', 'error=album_invalid&problems=required_fields_missing');
  }

  const input: AlbumCreateInput = {
    titleEn,
    titleTa,
    summaryEn,
    summaryTa,
    category,
    place,
    albumDate,
    publisher,
    eventId: category === 'events' ? eventId : undefined,
    area: {
      level: areaLevel,
      code: areaLevel === 'platform' ? null : areaCode,
    },
  };

  let createdId: string;
  try {
    const api = await staffApi();
    const album = await api.createAlbum(input);
    createdId = album.id;
  } catch (error) {
    newAlbumRefused(error);
  }

  redirect(`/gallery/albums/${createdId}?done=album_created`);
}

export async function updateAlbum(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  if (!UUID.test(albumId)) redirect('/gallery');

  const titleEn = String(formData.get('titleEn') ?? '').trim();
  const titleTa = String(formData.get('titleTa') ?? '').trim();
  const summaryEn = String(formData.get('summaryEn') ?? '').trim();
  const summaryTa = String(formData.get('summaryTa') ?? '').trim();
  const category = String(formData.get('category') ?? '') as AlbumCategory;
  const place = String(formData.get('place') ?? '').trim();
  const albumDate = String(formData.get('albumDate') ?? '').trim();
  const publisher = String(formData.get('publisher') ?? '').trim();
  const eventIdRaw = String(formData.get('eventId') ?? '').trim();

  const input: AlbumUpdateInput = {
    titleEn: titleEn || undefined,
    titleTa: titleTa || undefined,
    summaryEn,
    summaryTa,
    category: category || undefined,
    place,
    albumDate: albumDate || undefined,
    publisher: publisher || undefined,
    eventId: UUID.test(eventIdRaw) ? eventIdRaw : undefined,
  };

  try {
    const api = await staffApi();
    await api.updateAlbum(albumId, input);
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=album_updated');
}

export async function uploadPhoto(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  if (!UUID.test(albumId)) redirect('/gallery');

  const file = formData.get('photo') as File | null;
  if (!file || file.size === 0) {
    back(`/gallery/albums/${albumId}`, 'error=empty_file');
  }

  const allowedTypes: Record<string, GalleryImageType> = {
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/webp',
  };
  const mime = allowedTypes[file.type];
  if (!mime) {
    back(`/gallery/albums/${albumId}`, 'error=unsupported_type');
  }

  try {
    const api = await staffApi();
    const buffer = await file.arrayBuffer();
    await api.uploadAlbumPhoto(albumId, buffer, mime);
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=photo_uploaded');
}

export async function updatePhotoCaptions(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  const photoId = String(formData.get('photoId') ?? '');
  if (!UUID.test(albumId) || !UUID.test(photoId)) redirect('/gallery');

  const captionEn = String(formData.get('captionEn') ?? '').trim();
  const captionTa = String(formData.get('captionTa') ?? '').trim();

  try {
    const api = await staffApi();
    await api.updatePhotoCaptions(photoId, { captionEn, captionTa });
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=captions_saved');
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  const photoId = String(formData.get('photoId') ?? '');
  if (!UUID.test(albumId) || !UUID.test(photoId)) redirect('/gallery');

  try {
    const api = await staffApi();
    await api.deletePhoto(photoId);
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=photo_deleted');
}

export async function submitAlbum(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  if (!UUID.test(albumId)) redirect('/gallery');

  try {
    const api = await staffApi();
    await api.submitAlbum(albumId);
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=album_submitted');
}

export async function publishAlbum(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  if (!UUID.test(albumId)) redirect('/gallery');

  const confirmed = formData.get('confirmPublish') === '1';
  if (!confirmed) {
    back(`/gallery/albums/${albumId}`, 'error=album_invalid&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.publishAlbum(albumId);
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=album_published');
}

export async function returnAlbum(formData: FormData): Promise<void> {
  const albumId = String(formData.get('albumId') ?? '');
  if (!UUID.test(albumId)) redirect('/gallery');

  const note = String(formData.get('note') ?? '').trim();
  if (!note || note.length < 3) {
    back(`/gallery/albums/${albumId}`, 'error=album_invalid&problems=note_required');
  }

  try {
    const api = await staffApi();
    await api.returnAlbum(albumId, note);
  } catch (error) {
    albumRefused(albumId, error);
  }

  back(`/gallery/albums/${albumId}`, 'done=album_returned');
}

export async function decideRemoval(formData: FormData): Promise<void> {
  const requestId = String(formData.get('requestId') ?? '');
  if (!UUID.test(requestId)) redirect('/gallery?tab=removals');

  const decision = String(formData.get('decision') ?? '') as RemovalDecisionInput['decision'];
  const reason = String(formData.get('reason') ?? '').trim();

  if (!['remove', 'blur', 'keep'].includes(decision)) {
    back('/gallery?tab=removals', 'error=decision_refused&problems=invalid_decision');
  }
  if (!reason || reason.length < 3) {
    back('/gallery?tab=removals', 'error=decision_refused&problems=reason_required');
  }

  try {
    const api = await staffApi();
    await api.decideRemovalRequest(requestId, { decision, reason });
  } catch (error) {
    removalRefused(error);
  }

  back('/gallery?tab=removals', 'done=removal_decided');
}
