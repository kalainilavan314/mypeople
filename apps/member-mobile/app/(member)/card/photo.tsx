import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, AuthorizedImage, Button, Notice, Screen, confirmAction, useApiAction, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { discardImage, pickImage } from '@/features/identity/pickImage';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * The member's own photo for the card: a voluntary upload just for the card, never the identity
 * selfie (BR-021). The API re-encodes it without its camera details and keeps it encrypted.
 */
export default function CardPhotoScreen() {
  const card = useApiQuery(() => api().getMyCard(), []);
  return (
    <Screen edges={['bottom']} maxContentWidth={640}>
      <QueryView query={card}>{(data) => <PhotoForm photoVersion={data.photoVersion ?? null} />}</QueryView>
    </Screen>
  );
}

function PhotoForm({ photoVersion }: { photoVersion: string | null }) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const add = useApiAction(async (source: 'camera' | 'library') => {
    setDenied(false);
    const picked = await pickImage(source, true);
    if ('denied' in picked) {
      setDenied(true);
      return;
    }
    if ('cancelled' in picked) return;
    try {
      await api().uploadMyCardPhoto(picked.image.body, picked.image.contentType);
    } finally {
      discardImage(picked.image); // the picker's copy is not kept once the server has the photo
    }
    router.back();
  });
  const remove = useApiAction(async () => {
    const confirmed = await confirmAction({
      title: t('m.card.photoRemove'),
      message: t('m.card.photoRemoveConfirm'),
      confirmLabel: t('m.card.photoRemove'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await api().removeMyCardPhoto();
    router.back();
  });
  const busy = add.busy || remove.busy;
  const error = add.error ?? remove.error;

  return (
    <>
      <View style={styles.frame}>
        {photoVersion ? (
          <AuthorizedImage
            uri={api().myCardPhotoUrl(photoVersion)}
            alt={t('m.card.photoTitle')}
            unavailableLabel={t('m.card.photoTitle')}
            style={styles.image}
          />
        ) : (
          <Ionicons name="person" size={96} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        )}
      </View>
      <AppText step="body" tone="secondary">{t('m.card.photoBody')}</AppText>
      {denied ? <Notice tone="warning">{t('m.card.photoCameraDenied')}</Notice> : null}
      {error ? <Notice tone="error">{errorMessage(t, error)}</Notice> : null}
      <Button label={t('m.card.photoTake')} icon="camera-outline" busy={add.busy} disabled={busy} onPress={() => void add.run('camera')} />
      <Button label={t('m.card.photoChoose')} icon="images-outline" variant="secondary" disabled={busy} onPress={() => void add.run('library')} />
      {photoVersion ? (
        <Button label={t('m.card.photoRemove')} icon="trash-outline" variant="danger" busy={remove.busy} disabled={busy} onPress={() => void remove.run()} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 168,
    height: 204,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 4,
    borderColor: colors.card,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
