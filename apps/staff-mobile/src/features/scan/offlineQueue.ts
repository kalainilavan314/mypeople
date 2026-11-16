import type { OfflineScanSync } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

const DEVICE_KEY = 'my_people_staff_attendance_device_v1';
const QUEUE_KEY = 'my_people_staff_attendance_queue_v1';
const MAX_QUEUE = 100;

type Device = { id: string; token: string };
type QueuedScan = {
  id: string;
  idempotencyKey: string;
  eventId: string;
  passCode: string;
  clientScanAt: string;
  localOutcome: string;
};

async function device(): Promise<Device | null> {
  const raw = await SecureStore.getItemAsync(DEVICE_KEY);
  return raw ? JSON.parse(raw) as Device : null;
}

async function queue(): Promise<QueuedScan[]> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  return raw ? JSON.parse(raw) as QueuedScan[] : [];
}

export async function prepareOfflineAttendance(): Promise<void> {
  if (await device()) return;
  const created = await api().registerStaffDevice(`${Platform.OS} staff app`);
  await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify({ id: created.id, token: created.deviceToken }));
}

export async function offlineAttendanceReady(): Promise<boolean> {
  return (await device()) !== null;
}

export async function queuedAttendanceCount(): Promise<number> {
  return (await queue()).length;
}

export async function queueAttendance(eventId: string, passCode: string): Promise<number> {
  if (!(await device())) throw new Error('offline_device_not_prepared');
  const pending = await queue();
  if (pending.length >= MAX_QUEUE) throw new Error('offline_queue_full');
  pending.push({
    id: Crypto.randomUUID(),
    idempotencyKey: Crypto.randomUUID(),
    eventId,
    passCode,
    clientScanAt: new Date().toISOString(),
    localOutcome: 'queued_unverified',
  });
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(pending));
  return pending.length;
}

export async function syncQueuedAttendance(): Promise<OfflineScanSync | null> {
  const [registered, scans] = await Promise.all([device(), queue()]);
  if (!registered || scans.length === 0) return null;
  const result = await api().syncOfflineScans({
    deviceId: registered.id,
    deviceToken: registered.token,
    scans,
  });
  const returned = new Set(result.results.map((item) => item.idempotencyKey));
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(scans.filter((item) => !returned.has(item.idempotencyKey))));
  return result;
}
