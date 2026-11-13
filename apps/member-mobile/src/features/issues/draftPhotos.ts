import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { discardImage, type PickedImage } from '@/features/identity/pickImage';

import { DraftPhotoError } from './issueErrors';

/**
 * The photos of the report being written. On a phone each is a JPEG in the app's private
 * document folder, so an unsent report keeps its photos when the app closes (FR-RPT-010); the
 * picker's own cache copy is removed once ours is written. The web version keeps them in memory
 * only (photos are too large for localStorage), so a reload loses photos not yet sent and the
 * form says so. pickImage has already re-encoded each one, which drops its location data.
 */
const isWeb = Platform.OS === 'web';
const webPhotos = new Map<string, { body: Blob; uri: string }>();

function photoFile(key: string): File {
  return new File(Paths.document, `issue-draft-photo-${key}.jpg`);
}

export async function keepPhoto(image: PickedImage, key: string): Promise<void> {
  try {
    if (isWeb) {
      const body = image.body instanceof Blob ? image.body : new Blob([image.body], { type: image.contentType });
      webPhotos.set(key, { body, uri: URL.createObjectURL(body) });
      return;
    }
    const bytes = image.body instanceof ArrayBuffer ? image.body : await image.body.arrayBuffer();
    await photoFile(key).write(new Uint8Array(bytes));
  } catch {
    throw new DraftPhotoError('keep');
  } finally {
    discardImage(image);
  }
}

/** Where the preview reads the photo from, or null when this device no longer has it. */
export function photoUri(key: string): string | null {
  if (isWeb) return webPhotos.get(key)?.uri ?? null;
  try {
    const file = photoFile(key);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** The photo's bytes for the upload. */
export async function readPhoto(key: string): Promise<Blob | ArrayBuffer> {
  try {
    if (isWeb) {
      const kept = webPhotos.get(key);
      if (kept) return kept.body;
    } else {
      const file = photoFile(key);
      if (file.exists) return await file.arrayBuffer();
    }
  } catch {
    // Reported below like a missing file.
  }
  throw new DraftPhotoError('read');
}

/** Removes this device's copy: when the photo is taken out of the report, or the report is sent or discarded. */
export function forgetPhoto(key: string): void {
  if (isWeb) {
    const kept = webPhotos.get(key);
    if (kept) URL.revokeObjectURL(kept.uri);
    webPhotos.delete(key);
    return;
  }
  try {
    const file = photoFile(key);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}
