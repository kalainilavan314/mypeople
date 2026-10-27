import type { IdentityDocumentKind } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import { AppText, Button, Notice, StatusTag, SurfaceCard, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { pickImage } from './pickImage';

type Props = {
  kind: IdentityDocumentKind;
  received: boolean;
  /** Named by the reviewer in a correction request. */
  requested: boolean;
  onUploaded: () => void;
};

/**
 * One identity image: whether the server holds it, and how to send it. A
 * selfie needs the live camera (FR-REG-014); ID pages may also come from the
 * phone's photos, the manual route when the camera is refused (FR-VOI-007).
 */
export function PhotoRow({ kind, received, requested, onUploaded }: Props) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const selfie = kind === 'selfie';
  const upload = useApiAction(async (source: 'camera' | 'library') => {
    setDenied(false);
    const picked = await pickImage(source, selfie);
    if ('denied' in picked) {
      setDenied(true);
      return;
    }
    if ('cancelled' in picked) return;
    await api().uploadIdentityDocument(kind, picked.image.body, picked.image.contentType);
    onUploaded();
  });

  return (
    <SurfaceCard style={requested && styles.requested}>
      <View style={styles.header}>
        <AppText step="card" style={styles.flex}>
          {t(`m.verify.${kind}`)}
        </AppText>
        {requested ? (
          <StatusTag tone="pending" label={t('m.verify.status_needs_update')} />
        ) : (
          <StatusTag tone={received ? 'verified' : 'neutral'} label={received ? t('m.verify.received') : t('m.verify.needed')} />
        )}
      </View>
      {selfie ? (
        <AppText step="secondary" tone="muted">
          {t('m.verify.selfieCameraOnly')}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={received && !requested ? t('m.verify.replace') : t('m.verify.takePhoto')}
          icon="camera-outline"
          variant={received && !requested ? 'secondary' : 'primary'}
          busy={upload.busy}
          busyLabel={t('m.verify.uploading')}
          onPress={() => void upload.run('camera')}
        />
        {!selfie ? (
          <Button
            label={t('m.verify.choosePhoto')}
            icon="images-outline"
            variant="secondary"
            disabled={upload.busy}
            onPress={() => void upload.run('library')}
          />
        ) : null}
      </View>
      {denied ? <Notice tone="warning">{selfie ? t('m.verify.selfieDenied') : t('m.verify.cameraDenied')}</Notice> : null}
      {upload.error ? <Notice tone="error">{errorMessage(t, upload.error)}</Notice> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  requested: { borderColor: colors.warning },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  actions: { gap: spacing[2] },
});
