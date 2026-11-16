import type { IssueCategory, IssueLocationKind, IssueVisibility } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';
import { useEffect, useSyncExternalStore } from 'react';

import { forgetPhoto, photoUri } from './draftPhotos';
import { readDraftText, removeDraftText, writeDraftText } from './draftStorage';

/** A photo in the draft: this device's copy, and the server's id once it was uploaded. */
export type DraftPhoto = { key: string; photoId: string | null };

/**
 * The report being written (H07, H08). It is saved on the device after every change, so it
 * survives a lost connection or a closed app (FR-RPT-010). The report and review screens share
 * this one copy, so photo ids stored while sending are never lost by going back to edit.
 */
export type IssueDraft = {
  /** Whose draft it is: someone else signing in on this phone never sees it. */
  memberId: string;
  /** Made once per draft, so sending it again returns the first receipt instead of a second case (FR-RPT-013). */
  clientReference: string;
  category: IssueCategory | null;
  title: string;
  description: string;
  locationKind: IssueLocationKind;
  locationText: string;
  /** Team only unless the member chooses the public summary (FR-RPT-011). */
  visibility: IssueVisibility;
  photos: DraftPhoto[];
};

type Snapshot = {
  draft: IssueDraft | null;
  /** Unsent photos from the saved draft that this device no longer has (the web version keeps none). */
  lostPhotos: number;
};

const EMPTY: Snapshot = { draft: null, lostPhotos: 0 };

let snapshot: Snapshot = EMPTY;
let loadingFor: string | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function newDraft(memberId: string): IssueDraft {
  return {
    memberId,
    clientReference: Crypto.randomUUID(),
    category: null,
    title: '',
    description: '',
    locationKind: 'my_gn',
    locationText: '',
    visibility: 'team',
    photos: [],
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The saved draft, or null when there is none or it cannot be read. */
function parse(saved: string | null): IssueDraft | null {
  if (!saved) return null;
  try {
    const value = JSON.parse(saved) as Partial<IssueDraft>;
    if (typeof value.memberId !== 'string' || typeof value.clientReference !== 'string') return null;
    const photos = Array.isArray(value.photos)
      ? value.photos.filter((photo): photo is DraftPhoto => typeof photo?.key === 'string')
      : [];
    return {
      memberId: value.memberId,
      clientReference: value.clientReference,
      category: value.category ?? null,
      title: text(value.title),
      description: text(value.description),
      locationKind: value.locationKind ?? 'my_gn',
      locationText: text(value.locationText),
      visibility: value.visibility === 'public' ? 'public' : 'team',
      photos: photos.map((photo) => ({ key: photo.key, photoId: typeof photo.photoId === 'string' ? photo.photoId : null })),
    };
  } catch {
    return null;
  }
}

// Writes go one at a time and only the newest waits, so typing never queues up stale copies.
type Pending = { text: string } | 'remove';
let pending: Pending | null = null;
let flushing = false;

async function flush() {
  if (flushing) return;
  flushing = true;
  while (pending) {
    const next = pending;
    pending = null;
    if (next === 'remove') await removeDraftText();
    else await writeDraftText(next.text);
  }
  flushing = false;
}

function persist(next: Pending) {
  pending = next;
  void flush();
}

async function load(memberId: string) {
  if (snapshot.draft?.memberId === memberId || loadingFor === memberId) return;
  loadingFor = memberId;
  const saved = parse(await readDraftText());
  loadingFor = null;
  if (saved && saved.memberId !== memberId) {
    // Left by another member on this phone: removed, never shown.
    for (const photo of saved.photos) forgetPhoto(photo.key);
    persist('remove');
  }
  if (!saved || saved.memberId !== memberId) {
    publish({ draft: newDraft(memberId), lostPhotos: 0 });
    return;
  }
  // A photo the server already holds still counts; an unsent one this device lost cannot be sent.
  const photos = saved.photos.filter((photo) => photo.photoId !== null || photoUri(photo.key) !== null);
  publish({ draft: { ...saved, photos }, lostPhotos: saved.photos.length - photos.length });
}

/** Changes the draft and saves it on the device at once. */
export function updateDraft(change: (draft: IssueDraft) => IssueDraft) {
  const current = snapshot.draft;
  if (!current) return;
  const next = change(current);
  publish({ ...snapshot, draft: next });
  persist({ text: JSON.stringify(next) });
}

/** After the report was sent, or when the member discards it: no copy stays on the device. */
export function resetDraft() {
  const current = snapshot.draft;
  if (!current) return;
  for (const photo of current.photos) forgetPhoto(photo.key);
  publish({ draft: newDraft(current.memberId), lostPhotos: 0 });
  persist('remove');
}

/** The signed-in member's draft; null while it loads from the device. */
export function useIssueDraft(memberId: string): Snapshot {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => {
    void load(memberId);
  }, [memberId]);
  return current.draft?.memberId === memberId ? current : EMPTY;
}
