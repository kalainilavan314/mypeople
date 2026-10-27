import Ionicons from '@expo/vector-icons/Ionicons';
import type { RemovalReceipt, RemovalRequestInput } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  ChipRow,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { GalleryImage } from '@/components/GalleryImage';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Reason = RemovalRequestInput['reason'];

/**
 * G03: one photo with its caption, previous and next, and the way to ask for
 * its removal. A request gets a receipt with its 24-hour answer time (FR-GAL-007).
 */
export default function PhotoScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const params = useLocalSearchParams<{ albumId: string; index: string }>();
  const [index, setIndex] = useState(Number(params.index ?? 0));
  const album = useApiQuery(() => api().getAlbum(params.albumId), [params.albumId]);

  return (
    <Screen edges={['bottom']}>
      <QueryView query={album}>
        {(data) => {
          const photo = data.photos[Math.min(index, data.photos.length - 1)];
          if (!photo) return null;
          const caption = localized(photo.captionEn, photo.captionTa);
          return (
            <>
              <View style={[styles.frame, { aspectRatio: photo.width / photo.height || 4 / 3 }]}>
                <GalleryImage key={photo.id} photoId={photo.id} size="display" alt={caption} style={StyleSheet.absoluteFill} />
              </View>
              {photo.blurred ? <StatusTag tone="neutral" label={t('m.gallery.blurred')} /> : null}
              <AppText step="body">{caption}</AppText>
              <View style={styles.pager}>
                <Pressable
                  onPress={() => setIndex(index - 1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel={t('m.gallery.previous')}
                  aria-disabled={index === 0}
                  style={[styles.pageButton, index === 0 && styles.disabled]}>
                  <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </Pressable>
                <AppText step="label" tone="muted" accessibilityLiveRegion="polite">
                  {t('m.gallery.photoOf', { n: photo.number, total: data.photos.length })}
                </AppText>
                <Pressable
                  onPress={() => setIndex(index + 1)}
                  disabled={index >= data.photos.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('m.gallery.next')}
                  aria-disabled={index >= data.photos.length - 1}
                  style={[styles.pageButton, index >= data.photos.length - 1 && styles.disabled]}>
                  <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                </Pressable>
              </View>
              <RemovalRequest key={photo.id} photoId={photo.id} />
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function RemovalRequest({ photoId }: { photoId: string }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('appears_in_photo');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<RemovalReceipt | null>(null);
  const send = useApiAction(async () => {
    setReceipt(await api().requestPhotoRemoval(photoId, { reason, note: note.trim() }));
  });

  if (receipt) {
    return (
      <Notice tone="success">
        {t('m.gallery.receipt', { ref: receipt.requestRef, due: formatDateTime(receipt.dueAt, language) })}
      </Notice>
    );
  }
  if (!open) {
    return <Button label={t('m.gallery.removeTitle')} variant="secondary" icon="flag-outline" onPress={() => setOpen(true)} />;
  }
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('m.gallery.removeTitle')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.gallery.removeHint')}
      </AppText>
      <View style={styles.reasons}>
        <ChipRow
          label={t('m.gallery.removeTitle')}
          selected={reason}
          onSelect={setReason}
          options={[
            { key: 'appears_in_photo', label: t('m.gallery.reason_appears_in_photo') },
            { key: 'safety', label: t('m.gallery.reason_safety') },
            { key: 'inaccurate', label: t('m.gallery.reason_inaccurate') },
            { key: 'other', label: t('m.gallery.reason_other') },
          ]}
        />
      </View>
      <TextField label={t('m.gallery.note')} optional value={note} onChangeText={setNote} multiline maxLength={500} />
      {send.error ? <Notice tone="error">{errorMessage(t, send.error)}</Notice> : null}
      <Button label={t('m.gallery.sendRequest')} busy={send.busy} busyLabel={t('m.common.sending')} onPress={() => void send.run()} />
      <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setOpen(false)} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surfaceVariant },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageButton: {
    width: control.touchMin,
    height: control.touchMin,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  disabled: { opacity: 0.4 },
  reasons: { marginVertical: spacing[1] },
});
