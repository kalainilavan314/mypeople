import type { ImageStyle, StyleProp } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthorizedImage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

type Props = {
  photoId: string;
  size: 'thumb' | 'display';
  alt: string;
  style?: StyleProp<ImageStyle>;
};

/** A gallery photo, served only through the API to signed-in members. */
export function GalleryImage({ photoId, size, alt, style }: Props) {
  const { t } = useTranslation();
  return (
    <AuthorizedImage
      uri={api().galleryPhotoUrl(photoId, size)}
      alt={alt}
      unavailableLabel={t('m.gallery.unavailable')}
      style={style}
    />
  );
}
