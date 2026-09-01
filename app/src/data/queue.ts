// Offline write queue backed by IndexedDB.
// Field reports (and, by the same pattern, RSVPs / survey votes) are enqueued with a
// client-generated `clientUuid`. The server upserts on that key so a replayed queue can
// never create a duplicate (see PROJECT.md "Offline first").

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type QueueKind = 'report' | 'rsvp' | 'survey_vote';

export interface QueuedItem<T = unknown> {
  clientUuid: string;
  kind: QueueKind;
  payload: T;
  createdAt: string;
  attempts: number;
}

interface NpmDB extends DBSchema {
  outbox: {
    key: string; // clientUuid
    value: QueuedItem;
    indexes: { 'by-kind': string };
  };
}

let dbPromise: Promise<IDBPDatabase<NpmDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<NpmDB>('npm-app', 1, {
      upgrade(database) {
        const store = database.createObjectStore('outbox', { keyPath: 'clientUuid' });
        store.createIndex('by-kind', 'kind');
      },
    });
  }
  return dbPromise;
}

export function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for older WebViews on budget devices.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function enqueue<T>(kind: QueueKind, clientUuid: string, payload: T): Promise<void> {
  const database = await db();
  // Idempotent by clientUuid: enqueuing the same key twice is a no-op replace.
  await database.put('outbox', {
    clientUuid,
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

export async function pending(): Promise<QueuedItem[]> {
  const database = await db();
  return database.getAll('outbox');
}

export async function pendingCount(): Promise<number> {
  const database = await db();
  return database.count('outbox');
}

export async function ack(clientUuid: string): Promise<void> {
  const database = await db();
  await database.delete('outbox', clientUuid);
}

export async function bumpAttempt(clientUuid: string): Promise<void> {
  const database = await db();
  const item = await database.get('outbox', clientUuid);
  if (item) {
    item.attempts += 1;
    await database.put('outbox', item);
  }
}
