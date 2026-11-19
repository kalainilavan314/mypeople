import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * M26: the receipt code is shown once and the server never stores it (FR-PBG-005), so this phone
 * keeps a copy in the keychain or keystore for the member who voted, to show again under "You
 * took part". It confirms only that the ballot was counted, never the choice. The web version has
 * no secure store, so it keeps the code in memory until the page is closed.
 */
const isWeb = Platform.OS === 'web';
const memory = new Map<string, string>();

function keyFor(memberId: string, cycleId: string): string {
  return `mp.pb.receipt.${memberId}.${cycleId}`;
}

export async function saveReceipt(memberId: string, cycleId: string, code: string): Promise<void> {
  const key = keyFor(memberId, cycleId);
  try {
    if (isWeb) memory.set(key, code);
    else await SecureStore.setItemAsync(key, code, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    // The receipt was already shown; a phone that cannot store it only loses the later reminder.
  }
}

export async function readReceipt(memberId: string, cycleId: string): Promise<string | null> {
  const key = keyFor(memberId, cycleId);
  try {
    if (isWeb) return memory.get(key) ?? null;
    return await SecureStore.getItemAsync(key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    return null;
  }
}
