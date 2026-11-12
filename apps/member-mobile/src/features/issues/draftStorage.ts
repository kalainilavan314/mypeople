import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// The text of the report being written (FR-RPT-010), kept on this device only so it survives a
// lost connection or a closed app: a JSON file in the app's private document folder, or
// localStorage in the web version. Nothing here is sent anywhere; failures are swallowed so the
// form keeps working from memory.
const FILE_NAME = 'issue-report-draft.json';
const WEB_KEY = 'mp.issueDraft';

const isWeb = Platform.OS === 'web';

function draftFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export async function readDraftText(): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(WEB_KEY) ?? null;
    const file = draftFile();
    return file.exists ? await file.text() : null;
  } catch {
    return null;
  }
}

export async function writeDraftText(text: string): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.setItem(WEB_KEY, text);
    else await draftFile().write(text);
  } catch {
    // A full disk or a private browser window: the draft then lasts until the app closes.
  }
}

export async function removeDraftText(): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.removeItem(WEB_KEY);
      return;
    }
    const file = draftFile();
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}
