import type { OfficialRevision } from '@my-people/api-client';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@my-people/design-tokens/mobile';
import { AuthorizedImage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * The image a revision was signed with. It is served without a session; its SHA-256 is part of the
 * signature, so a changed image would no longer verify. With the data saver on it waits for a tap.
 */
export function OfficialImage({ revision }: { revision: OfficialRevision }) {
  const { t } = useTranslation();
  if (!revision.imageId) return null;
  const ratio = revision.imageWidth && revision.imageHeight ? revision.imageWidth / revision.imageHeight : 16 / 9;
  return (
    <AuthorizedImage
      uri={api().officialImageUrl(revision.imageId, 'display')}
      alt={t('m.official.imageAlt')}
      unavailableLabel={t('m.official.imageUnavailable')}
      tapToLoadLabel={t('m.official.tapToLoadImage')}
      resizeMode="contain"
      style={[styles.image, { aspectRatio: ratio }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: radius.card, backgroundColor: colors.surfaceVariant },
});
