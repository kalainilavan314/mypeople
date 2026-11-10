import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { MemberCard } from '@my-people/api-client';

// The session token and refresh token live in the device's keychain or keystore
// (SecureStore). The web preview has no secure store, so there they stay in
// memory only and a reload signs the member out: they are never written to
// localStorage, where any script on the page could read them.
const TOKEN_KEY = 'mp.session';
const REFRESH_KEY = 'mp.refresh';
const DEVICE_KEY = 'mp.device';
const LANGUAGE_KEY = 'mp.language';
const DISPLAY_KEY = 'mp.display';
const CARD_PREVIEW_KEY = 'mp.cardPreview';

export type OfflineCardPreview = {
  memberId: string;
  syncedAt: string;
  displayName: string;
  memberCode: string;
  districtName: string | null;
  gnName: string | null;
};

const isWeb = Platform.OS === 'web';
let webToken: string | null = null;
let webRefreshToken: string | null = null;

export async function readToken(): Promise<string | null> {
  return isWeb ? webToken : SecureStore.getItemAsync(TOKEN_KEY);
}

export async function readRefreshToken(): Promise<string | null> {
  return isWeb ? webRefreshToken : SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveTokens(token: string, refreshToken: string): Promise<void> {
  if (isWeb) {
    webToken = token;
    webRefreshToken = refreshToken;
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

/**
 * Forgets the session and the personal data it left on this device: both
 * tokens and the saved member card, at sign-out or when the session ends
 * (FR-PROF-016).
 */
export async function clearSession(): Promise<void> {
  if (isWeb) {
    webToken = null;
    webRefreshToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(CARD_PREVIEW_KEY);
}

/** A saved visual copy only. It has no QR and is never accepted as proof of current membership. */
export async function readOfflineCard(): Promise<OfflineCardPreview | null> {
  if (isWeb) return null;
  try {
    const raw = await SecureStore.getItemAsync(CARD_PREVIEW_KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null) return null;
    const preview = saved as Partial<OfflineCardPreview>;
    if (typeof preview.memberId !== 'string' || typeof preview.syncedAt !== 'string' || !Number.isFinite(Date.parse(preview.syncedAt)) ||
        typeof preview.displayName !== 'string' || typeof preview.memberCode !== 'string' ||
        (preview.districtName !== null && typeof preview.districtName !== 'string') ||
        (preview.gnName !== null && typeof preview.gnName !== 'string')) return null;
    return preview as OfflineCardPreview;
  } catch {
    return null;
  }
}

export async function saveOfflineCard(memberId: string, card: MemberCard): Promise<void> {
  if (isWeb || !card.available) return;
  const preview: OfflineCardPreview = {
    memberId,
    syncedAt: new Date().toISOString(),
    displayName: card.displayName ?? '',
    memberCode: card.memberCode ?? '',
    districtName: card.districtName,
    gnName: card.gnName,
  };
  await SecureStore.setItemAsync(CARD_PREVIEW_KEY, JSON.stringify(preview));
}

export async function clearOfflineCard(): Promise<void> {
  if (!isWeb) await SecureStore.deleteItemAsync(CARD_PREVIEW_KEY);
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

export type StoredDisplayPreferences = { textSize: 'standard' | 'large' | 'larger'; dataSaver: boolean };

/** M44 text size and data saver; not sensitive, kept like the language (localStorage on the web preview). */
export async function readDisplayPreferences(): Promise<StoredDisplayPreferences | null> {
  let raw: string | null = null;
  try {
    raw = isWeb ? (globalThis.localStorage?.getItem(DISPLAY_KEY) ?? null) : await SecureStore.getItemAsync(DISPLAY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDisplayPreferences>;
    const textSize = parsed.textSize === 'large' || parsed.textSize === 'larger' ? parsed.textSize : 'standard';
    return { textSize, dataSaver: parsed.dataSaver === true };
  } catch {
    return null; // an unreadable value falls back to the defaults
  }
}

export async function saveDisplayPreferences(prefs: StoredDisplayPreferences): Promise<void> {
  const raw = JSON.stringify(prefs);
  if (!isWeb) return SecureStore.setItemAsync(DISPLAY_KEY, raw);
  try {
    globalThis.localStorage?.setItem(DISPLAY_KEY, raw);
  } catch {
    // Private windows may refuse storage; the choice then lasts until reload.
  }
}
