import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { body: Blob; contentType: 'image/jpeg' | 'image/png' | 'image/heic' };

export type PickResult = { image: PickedImage } | { cancelled: true } | { denied: true };

/**
 * A photo from the camera, or from the phone's photos as the manual route when
 * the camera is refused or broken (FR-VOI-007). The picker re-encodes to JPEG
 * at 80% quality, which keeps phone photos under the API's 10 MB limit.
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
  return { image: { body, contentType: type } };
}
