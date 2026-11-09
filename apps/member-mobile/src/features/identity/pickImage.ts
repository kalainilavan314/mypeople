import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PickedImage = {
  body: Blob;
  contentType: 'image/jpeg' | 'image/png' | 'image/heic';
  /** The picker's copy in the app's private cache; never the phone's photo gallery. */
  uri: string;
};

export type PickResult = { image: PickedImage } | { cancelled: true } | { denied: true };

/**
 * A photo from the camera, or from the phone's photos as the manual route when
 * the camera is refused or broken (FR-VOI-007). The picker re-encodes to JPEG
 * at 80% quality, which keeps phone photos under the API's 10 MB limit. A
 * camera photo is written only to the app's private cache, not the gallery.
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
  const body = await (await fetch(asset.uri)).blob();
  const type = asset.mimeType === 'image/png' || asset.mimeType === 'image/heic' ? asset.mimeType : 'image/jpeg';
  return { image: { body, contentType: type, uri: asset.uri } };
}

/**
 * Removes the app's cached copy of an ID photo or selfie once the server has
 * acknowledged it, or when it is replaced or abandoned, so no copy stays on
 * the phone (FR-REG-035, BR-021). A photo chosen from the gallery stays in
 * the gallery: only the picker's copy is ours to delete.
 */
export function discardImage(image: PickedImage): void {
  if (Platform.OS === 'web') return; // the web preview holds the photo in memory only
  try {
    const copy = new File(image.uri);
    if (copy.exists) copy.delete();
  } catch {
    // Already gone, or the OS cleared its cache first; there is nothing left to remove.
  }
}
