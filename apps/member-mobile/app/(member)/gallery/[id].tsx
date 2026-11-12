import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText, formatDate, Screen, useApiQuery, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { GalleryImage } from '@/components/GalleryImage';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** G02: an album with its publisher, place, date, summary and numbered photos. */
export default function AlbumScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const { id } = useLocalSearchParams<{ id: string }>();
  const album = useApiQuery(() => api().getAlbum(id), [id]);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={album.reload}
      refreshing={album.loading && album.data !== undefined}>
      <QueryView query={album}>
        {(data) => (
          <>
            <AppText step="page" accessibilityRole="header">
              {localized(data.titleEn, data.titleTa)}
            </AppText>
            <AppText step="secondary" tone="muted">
              {`${data.place} · ${formatDate(data.albumDate, language)}`}
            </AppText>
            <AppText step="secondary" tone="secondary">
              {t('m.gallery.by', { publisher: data.publisher })}
            </AppText>
            {data.eventId && data.eventTitleEn ? (
              <Pressable
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: data.eventId as string } })}
                accessibilityRole="link">
                <AppText step="label" tone="primary">
                  {localized(data.eventTitleEn, data.eventTitleTa ?? '')}
                </AppText>
              </Pressable>
            ) : null}
            <AppText step="body" tone="secondary">
              {localized(data.summaryEn, data.summaryTa)}
            </AppText>
            <AppText step="label" tone="muted">
              {t('m.gallery.photos', { count: data.photos.length })}
            </AppText>
            <View style={styles.grid} accessibilityRole="list">
              {data.photos.map((photo, index) => {
                const caption = localized(photo.captionEn, photo.captionTa);
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => router.push({ pathname: '/gallery/photo', params: { albumId: data.id, index: String(index) } })}
                    accessibilityRole="button"
                    accessibilityHint={t('m.gallery.openPhoto')}
                    accessibilityLabel={`${t('m.gallery.photoOf', { n: photo.number, total: data.photos.length })}. ${caption}`}
                    style={styles.tile}>
                    <GalleryImage photoId={photo.id} size="thumb" alt={caption} style={StyleSheet.absoluteFill} />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    flexBasis: '31%',
    minWidth: 100,
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radius.control,
    overflow: 'hidden',
    backgroundColor: colors.surfaceVariant,
  },
});
