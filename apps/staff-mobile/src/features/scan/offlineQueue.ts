import type { QueuedScanInput, ScanOutcome } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

/**
 * Offline check-in on the staff phone (MP-DEC-001 4.3). A pass scanned while there is no
 * connection is kept in the keychain or keystore, never shown as a check-in, and sent to the
 * server when the phone is back online; the server judges it as at the moment it was recorded.
 * Only the opaque pass code is kept, never a name, photo or NIC. The web preview has no secure
 * store, so it keeps the queue in memory only.
 */
export type QueuedScan = QueuedScanInput & { eventId: string; staffMemberId: string };

type Device = { id: string; key: string; registered: boolean };

const INDEX_KEY = 'mp.scanq.index';
const ITEM_PREFIX = 'mp.scanq.';
const DEVICE_KEY = 'mp.scanner.device';
const BATCH = 200; // the API's largest batch

const isWeb = Platform.OS === 'web';
const memory = new Map<string, string>();

async function read(key: string): Promise<string | null> {
  return isWeb ? (memory.get(key) ?? null) : SecureStore.getItemAsync(key);
}

async function write(key: string, value: string): Promise<void> {
  if (isWeb) memory.set(key, value);
  else await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  if (isWeb) memory.delete(key);
  else await SecureStore.deleteItemAsync(key);
}

async function index(): Promise<string[]> {
  try {
    const raw = await read(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Keeps one scan for later. Each scan is its own entry, so a large queue stays within the store's limits. */
export async function enqueueScan(eventId: string, staffMemberId: string, code: string): Promise<void> {
  const scan: QueuedScan = {
    scanEventId: Crypto.randomUUID(),
    idempotencyKey: Crypto.randomUUID(),
    code,
    clientScanAt: new Date().toISOString(),
    localOutcome: 'queued_offline',
    eventId,
    staffMemberId,
  };
  await write(ITEM_PREFIX + scan.scanEventId, JSON.stringify(scan));
  await write(INDEX_KEY, JSON.stringify([...(await index()), scan.scanEventId]));
}

/** This staff member's scans for this event still waiting to be sent. */
export async function queuedScans(eventId: string, staffMemberId: string): Promise<QueuedScan[]> {
  const scans: QueuedScan[] = [];
  for (const id of await index()) {
    const raw = await read(ITEM_PREFIX + id);
    if (!raw) continue;
    const scan = JSON.parse(raw) as QueuedScan;
    if (scan.eventId === eventId && scan.staffMemberId === staffMemberId) scans.push(scan);
  }
  return scans;
}

async function forget(ids: string[]): Promise<void> {
  const gone = new Set(ids);
  for (const id of ids) await remove(ITEM_PREFIX + id);
  await write(INDEX_KEY, JSON.stringify((await index()).filter((id) => !gone.has(id))));
}

/** This phone's id and secret for offline check-in, made once and registered with the server once. */
async function scannerDevice(): Promise<Device> {
  const raw = await read(DEVICE_KEY);
  if (raw) return JSON.parse(raw) as Device;
  const device: Device = { id: Crypto.randomUUID(), key: `${Crypto.randomUUID()}${Crypto.randomUUID()}`, registered: false };
  await write(DEVICE_KEY, JSON.stringify(device));
  return device;
}

/**
 * Sends this event's queued scans and forgets each one the server answered. Every outcome is
 * final for the phone: accepted, already checked in, refused, or waiting for a person on the server.
 */
export async function syncScans(eventId: string, staffMemberId: string): Promise<ScanOutcome[]> {
  const scans = await queuedScans(eventId, staffMemberId);
  if (scans.length === 0) return [];
  const device = await scannerDevice();
  if (!device.registered) {
    await api().registerScannerDevice(device.id, device.key, `Staff phone (${Platform.OS})`);
    await write(DEVICE_KEY, JSON.stringify({ ...device, registered: true }));
  }
  const outcomes: ScanOutcome[] = [];
  for (let start = 0; start < scans.length; start += BATCH) {
    const batch = scans.slice(start, start + BATCH);
    const answer = await api().syncOfflineScans(
      eventId,
      device.id,
      device.key,
      batch.map(({ scanEventId, idempotencyKey, code, clientScanAt, localOutcome }) => ({
        scanEventId,
        idempotencyKey,
        code,
        clientScanAt,
        localOutcome,
      })),
    );
    await forget(answer.outcomes.map((outcome) => outcome.scanEventId));
    outcomes.push(...answer.outcomes);
  }
  return outcomes;
}
