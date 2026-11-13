import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Field visits wait on the phone encrypted: expo-secure-store keeps each value in the Android
// Keystore-backed encrypted storage (AES) or the iOS Keychain, on this device only. A value should
// stay under about 2 KB, and a Tamil note of 1,000 letters is about 3 KB, so each text is split into
// chunks of 600 characters (at most 1,800 bytes each).
//
// The web version has no encrypted store, so there the visits live in memory only and are gone when
// the page closes; the screens say so.

const CHUNK = 600;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const encryptedOnDevice = Platform.OS !== 'web';

const memory = new Map<string, string>();

async function get(key: string): Promise<string | null> {
  return encryptedOnDevice ? SecureStore.getItemAsync(key, OPTIONS) : (memory.get(key) ?? null);
}

async function set(key: string, value: string): Promise<void> {
  if (encryptedOnDevice) await SecureStore.setItemAsync(key, value, OPTIONS);
  else memory.set(key, value);
}

async function remove(key: string): Promise<void> {
  if (encryptedOnDevice) await SecureStore.deleteItemAsync(key, OPTIONS);
  else memory.delete(key);
}

async function count(key: string): Promise<number> {
  const stored = Number(await get(`${key}.count`));
  return Number.isInteger(stored) && stored > 0 ? stored : 0;
}

/** Writes the text in chunks, then the count, and removes chunks a longer earlier copy left. */
export async function writeChunked(key: string, text: string): Promise<void> {
  const before = await count(key);
  const parts: string[] = [];
  for (let start = 0; start < text.length; start += CHUNK) parts.push(text.slice(start, start + CHUNK));
  if (parts.length === 0) parts.push('');
  for (const [index, part] of parts.entries()) await set(`${key}.${index}`, part);
  await set(`${key}.count`, String(parts.length));
  for (let index = parts.length; index < before; index += 1) await remove(`${key}.${index}`);
}

/** The whole text, or null when it is missing or a chunk was lost. */
export async function readChunked(key: string): Promise<string | null> {
  const total = await count(key);
  if (total === 0) return null;
  const parts: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const part = await get(`${key}.${index}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

export async function removeChunked(key: string): Promise<void> {
  const total = await count(key);
  for (let index = 0; index < total; index += 1) await remove(`${key}.${index}`);
  await remove(`${key}.count`);
}
