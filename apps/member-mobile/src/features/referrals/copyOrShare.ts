import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

/** H19 one-tap copy, on phones and on the web; false when the clipboard refused (the text stays selectable). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

function closedUnsent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * Opens the share sheet with the text, a separate action from Copy. iOS and the web say when it
 * was closed without sharing ('dismissed'); Android always reports 'shared'. A browser with no
 * share sheet copies the text instead ('copied'), or 'dismissed' when even that fails.
 */
export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message: text });
    // react-native-web resolves with nothing once the browser's share sheet has shared.
    return result?.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (error) {
    // The web's share sheet rejects with AbortError when it is closed unsent.
    if (closedUnsent(error)) return 'dismissed';
  }
  return (await copyText(text)) ? 'copied' : 'dismissed';
}
