import type { FieldVisit, FieldVisitConcern, FieldVisitInput } from '@my-people/api-client';
import { useEffect, useSyncExternalStore } from 'react';

import { readChunked, removeChunked, writeChunked } from './secureChunks';

/**
 * A visit recorded on the phone and not yet held by the server (S05, S06). Synced visits are
 * removed from the phone; the server's list shows them. A refused or conflicting visit stays until
 * the coordinator resolves it.
 */
export type LocalVisit = {
  /** Made once on the phone; the same visit always has the same id, so a resend never doubles it. */
  clientId: string;
  /** The server version this edit started from; null for a visit never synced. */
  baseVersion: number | null;
  /** The place, chosen by hand (S05): a GN division, or a DS division, or neither ('' when not set). */
  gnCode: string;
  dsCode: string;
  /** The coordinator chose to give no place; the visit is then counted under their one area. */
  noPlace: boolean;
  visitedAt: string;
  consent: 'given' | 'declined';
  concerns: FieldVisitConcern[];
  notes: string;
  placeText: string;
  followUp: string;
  caseNumber: string;
  confirmedNotPolitical: boolean;
  status: 'pending' | 'refused' | 'conflict';
  problems: string[];
  /** On a conflict, the server's copy to compare with. */
  server: FieldVisit | null;
};

type Index = { memberId: string; ids: string[] };
type Snapshot = { memberId: string | null; visits: LocalVisit[] };

const INDEX_KEY = 'fieldVisits.index';
const visitKey = (clientId: string) => `fieldVisit.${clientId}`;

let snapshot: Snapshot = { memberId: null, visits: [] };
const listeners = new Set<() => void>();
// One change at a time, so the index and the visits never disagree.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

function publish(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

async function readIndex(): Promise<Index | null> {
  const text = await readChunked(INDEX_KEY);
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Index>;
    return typeof value.memberId === 'string' && Array.isArray(value.ids)
      ? { memberId: value.memberId, ids: value.ids.filter((id): id is string => typeof id === 'string') }
      : null;
  } catch {
    return null;
  }
}

async function readVisit(clientId: string): Promise<LocalVisit | null> {
  const text = await readChunked(visitKey(clientId));
  if (!text) return null;
  try {
    // Visits saved before the place became optional have no DS code or no-place choice.
    const visit = JSON.parse(text) as Partial<LocalVisit> & Omit<LocalVisit, 'dsCode' | 'noPlace'>;
    return { ...visit, dsCode: visit.dsCode ?? '', noPlace: visit.noPlace ?? false };
  } catch {
    return null;
  }
}

async function wipe(index: Index | null) {
  for (const id of index?.ids ?? []) await removeChunked(visitKey(id));
  await removeChunked(INDEX_KEY);
}

/** The signed-in coordinator's visits; another member's, left on this phone, are removed unread. */
export function loadVisits(memberId: string): Promise<void> {
  return serial(async () => {
    const index = await readIndex();
    if (index && index.memberId !== memberId) await wipe(index);
    const ids = index?.memberId === memberId ? index.ids : [];
    const visits: LocalVisit[] = [];
    for (const id of ids) {
      const visit = await readVisit(id);
      if (visit) visits.push(visit);
    }
    publish({ memberId, visits });
  });
}

/** The ids stored for this member, from the phone itself rather than what is on screen. */
async function storedIds(memberId: string): Promise<string[]> {
  const index = await readIndex();
  if (index && index.memberId !== memberId) {
    await wipe(index);
    return [];
  }
  return index?.ids ?? [];
}

async function writeIndex(memberId: string, ids: string[]) {
  await writeChunked(INDEX_KEY, JSON.stringify({ memberId, ids }));
}

function shown(memberId: string): LocalVisit[] {
  return snapshot.memberId === memberId ? snapshot.visits : [];
}

export function saveVisit(memberId: string, visit: LocalVisit): Promise<void> {
  return serial(async () => {
    await writeChunked(visitKey(visit.clientId), JSON.stringify(visit));
    const ids = (await storedIds(memberId)).filter((id) => id !== visit.clientId);
    await writeIndex(memberId, [...ids, visit.clientId]);
    publish({ memberId, visits: [...shown(memberId).filter((item) => item.clientId !== visit.clientId), visit] });
  });
}

export function removeVisit(memberId: string, clientId: string): Promise<void> {
  return serial(async () => {
    await removeChunked(visitKey(clientId));
    await writeIndex(memberId, (await storedIds(memberId)).filter((id) => id !== clientId));
    publish({ memberId, visits: shown(memberId).filter((item) => item.clientId !== clientId) });
  });
}

/** On sign-out: no visit stays on the phone. */
export function clearFieldVisits(): Promise<void> {
  return serial(async () => {
    await wipe(await readIndex());
    publish({ memberId: null, visits: [] });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The visits waiting on this phone for the signed-in coordinator; null while they load. */
export function useLocalVisits(memberId: string): LocalVisit[] | null {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => {
    void loadVisits(memberId);
  }, [memberId]);
  return current.memberId === memberId ? current.visits : null;
}

/**
 * A declined visit keeps nothing that was typed, not even on this phone (FR-FLD-004): concerns,
 * notes, landmark, follow-up and case number are emptied before it is saved. The place and time stay.
 */
export function blankIfDeclined(visit: LocalVisit): LocalVisit {
  if (visit.consent !== 'declined') return visit;
  return { ...visit, concerns: [], notes: '', placeText: '', followUp: '', caseNumber: '', confirmedNotPolitical: false };
}

/** What the server is sent; a declined visit carries only its place and time (FR-FLD-004). */
export function toInput(visit: LocalVisit): FieldVisitInput {
  const declined = visit.consent === 'declined';
  const optional = (text: string) => (declined || text.trim() === '' ? null : text.trim());
  return {
    clientId: visit.clientId,
    baseVersion: visit.baseVersion,
    gnCode: visit.gnCode || null,
    dsCode: visit.gnCode ? null : visit.dsCode || null,
    visitedAt: visit.visitedAt,
    consent: visit.consent,
    concerns: declined ? [] : visit.concerns,
    notes: optional(visit.notes),
    placeText: optional(visit.placeText),
    followUp: optional(visit.followUp),
    caseNumber: optional(visit.caseNumber),
    confirmedNotPolitical: visit.confirmedNotPolitical,
  };
}
