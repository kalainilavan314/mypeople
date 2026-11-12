import type { AlbumSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText, ChipRow, formatDate, Screen, useApiQuery, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { GalleryImage } from '@/components/GalleryImage';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

type Category = 'all' | 'events' | 'community';

/** G01: published albums in two columns, each card one button with a 4:3 cover and a separate caption (spec §7). */
export default function GalleryScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>('all');
  const albums = useApiQuery(() => api().listAlbums({ category: category === 'all' ? undefined : category }), [category]);
  return (
    <Screen
      edges={[]}
      maxContentWidth={720}
      onRefresh={albums.reload}
      refreshing={albums.loading && albums.data !== undefined}>
      <AppText step="secondary" tone="muted">
        {t('m.gallery.subtitle')}
      </AppText>
      <ChipRow
        label={t('m.gallery.title')}
        selected={category}
        onSelect={setCategory}
        options={[
          { key: 'all', label: t('m.gallery.all') },
          { key: 'events', label: t('m.gallery.events') },
          { key: 'community', label: t('m.gallery.community') },
        ]}
      />
      <QueryView query={albums}>
        {(list) =>
          list.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.gallery.empty')}
            </AppText>
          ) : (
            <View style={styles.grid} accessibilityRole="list">
              {list.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

function AlbumCard({ album }: { album: AlbumSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(album.titleEn, album.titleTa);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/gallery/[id]', params: { id: album.id } })}
      accessibilityRole="button"
      accessibilityHint={t('m.gallery.openAlbum')}
      accessibilityLabel={`${title}, ${t('m.gallery.photos', { count: album.photoCount })}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cover}>
        {album.coverPhotoId ? (
          <GalleryImage photoId={album.coverPhotoId} size="thumb" alt={title} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.count}>
          <AppText step="caption" tone="inverse">
            {t('m.gallery.photos', { count: album.photoCount })}
          </AppText>
        </View>
      </View>
      <View style={styles.caption}>
        <AppText step="label" numberOfLines={2}>
          {title}
        </AppText>
        <AppText step="caption" tone="muted">
          {`${album.place} · ${formatDate(album.albumDate, language)}`}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: {
    flexBasis: '47%',
    minWidth: 150,
    flexGrow: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: colors.surfaceVariant },
  cover: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceVariant, justifyContent: 'flex-end' },
  count: {
    alignSelf: 'flex-start',
    margin: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.tag,
    backgroundColor: colors.primaryDark, // a dark chip, so the white count stays readable over any photo
  },
  caption: { padding: spacing[3], gap: 2 },
});
