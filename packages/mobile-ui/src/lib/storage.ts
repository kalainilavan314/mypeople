import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The session token lives in the device's keychain or keystore (SecureStore).
// The web preview has no secure store, so there the token stays in memory only
// and a reload signs the member out: it is never written to localStorage,
// where any script on the page could read it.
const TOKEN_KEY = 'mp.session';
const DEVICE_KEY = 'mp.device';
const LANGUAGE_KEY = 'mp.language';

const isWeb = Platform.OS === 'web';
let webToken: string | null = null;

export async function readToken(): Promise<string | null> {
  return isWeb ? webToken : SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (isWeb) webToken = token;
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (isWeb) webToken = null;
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** A random id for this install, sent as X-Device-Id so a sign-in from a new device can be noticed. */
export async function deviceId(): Promise<string | undefined> {
  if (isWeb) return undefined; // browsers leave it out
  const stored = await SecureStore.getItemAsync(DEVICE_KEY);
  if (stored) return stored;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY, created);
  return created;
}

/** The language the member chose; not sensitive, so the web preview keeps it in localStorage. */
export async function readLanguage(): Promise<string | null> {
  if (!isWeb) return SecureStore.getItemAsync(LANGUAGE_KEY);
  try {
    return globalThis.localStorage?.getItem(LANGUAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function saveLanguage(language: string): Promise<void> {
  if (!isWeb) return SecureStore.setItemAsync(LANGUAGE_KEY, language);
  try {
    globalThis.localStorage?.setItem(LANGUAGE_KEY, language);
  } catch {
    // Private windows may refuse storage; the choice then lasts until reload.
  }
}
