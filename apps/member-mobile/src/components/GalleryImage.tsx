import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import { api } from '@/lib/api';
import { readToken } from '@/lib/storage';

import { AppText } from './AppText';

type Props = {
  photoId: string;
  size: 'thumb' | 'display';
  alt: string;
  style?: StyleProp<ImageStyle>;
};

/**
 * A gallery photo, served only through the API to signed-in members: the app
 * sends its session token (the web preview relies on the session cookie). A
 * photo that cannot load shows a plain "Photo unavailable" region (spec §7).
 */
export function GalleryImage({ photoId, size, alt, style }: Props) {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    readToken().then((value) => active && setToken(value));
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <View style={[styles.unavailable, style]} accessibilityLabel={t('m.gallery.unavailable')}>
        <AppText step="caption" tone="muted">
          {t('m.gallery.unavailable')}
        </AppText>
      </View>
    );
  }
  if (token === undefined) return <View style={[styles.placeholder, style]} />;

  return (
    <Image
      source={{
        uri: api().galleryPhotoUrl(photoId, size),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }}
      accessibilityLabel={alt}
      resizeMode="cover"
      onError={() => setFailed(true)}
      style={[styles.placeholder, style]}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.surfaceVariant },
  unavailable: { backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', padding: spacing[2] },
});
