import { Platform, Share } from 'react-native';

type WebClipboard = { writeText: (text: string) => Promise<void> };

function webClipboard(): WebClipboard | null {
  if (Platform.OS !== 'web') return null;
  const browser = globalThis as { navigator?: { clipboard?: WebClipboard } };
  return browser.navigator?.clipboard ?? null;
}

/**
 * The app has no clipboard module (adding expo-clipboard means a new native build), so the phone
 * apps hand the code to the share sheet, which offers Copy; the web version copies it at once.
 */
export const copiesDirectly = webClipboard() !== null;

/** Copies the text (web) or opens the share sheet with it (phones); true once it was copied. */
export async function copyOrShare(text: string): Promise<boolean> {
  const clipboard = webClipboard();
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // The browser refused (no permission or not a secure page): the share sheet below instead.
    }
  }
  try {
    await Share.share({ message: text });
  } catch {
    // Closed or not available: nothing was shared.
  }
  return false;
}
