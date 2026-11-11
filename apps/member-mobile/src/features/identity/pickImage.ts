import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { ImagePreparationError } from '@/lib/errors';

export type PickedImage = {
  body: Blob | ArrayBuffer;
  byteSize: number;
  contentType: 'image/jpeg';
  previewUri: string;
};

export type PickResult = { image: PickedImage } | { cancelled: true } | { denied: true };

/**
 * A photo from the camera, or from the phone's photos as the manual route when
 * the camera is refused or broken (FR-VOI-007). Every source is decoded and
 * re-encoded as JPEG so the declared content type always matches the bytes the
 * API validates. The bounded decode also avoids loading full-resolution phone
 * photos into memory and keeps uploads below the API's size limit in practice.
 */
export async function pickImage(source: 'camera' | 'library', front = false): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { denied: true };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          ...options,
          cameraType: front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        })
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || result.assets.length === 0) return { cancelled: true };

  const asset = result.assets[0];
  let normalizedUri: string | null = null;
  try {
    const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 2560, maxHeight: 2560 });
    const rendered = await context.renderAsync();
    const normalized = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    normalizedUri = normalized.uri;

    const body: Blob | ArrayBuffer = Platform.OS === 'web'
      ? await (await fetch(normalizedUri)).blob()
      : await new File(normalizedUri).arrayBuffer();
    const byteSize = body instanceof ArrayBuffer ? body.byteLength : body.size;
    if (byteSize === 0) throw new Error('Image normalization produced an empty JPEG');

    const signature = body instanceof ArrayBuffer
      ? new Uint8Array(body, 0, Math.min(3, body.byteLength))
      : new Uint8Array(await body.slice(0, 3).arrayBuffer());
    if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
      throw new Error('Image normalization did not produce a JPEG');
    }

    return { image: { body, byteSize, contentType: 'image/jpeg', previewUri: asset.uri } };
  } catch {
    throw new ImagePreparationError();
  } finally {
    // The normalized identity image is transient evidence. Remove its native
    // cache file after loading the bytes; browsers manage their own blob URL.
    if (normalizedUri && Platform.OS !== 'web') {
      try {
        new File(normalizedUri).delete();
      } catch {
        // Cache cleanup must not turn a valid photo into a failed upload.
      }
    }
  }
}
