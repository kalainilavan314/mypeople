import { ApiError, type IdentityDocumentKind } from '@my-people/api-client';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import { AppText, Button, Notice, StatusTag, SurfaceCard, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { pickImage, type PickedImage } from './pickImage';

type Props = {
  kind: IdentityDocumentKind;
  received: boolean;
  /** Named by the reviewer in a correction request. */
  requested: boolean;
  target?: boolean;
  onUploaded: () => void;
};

/**
 * One identity image: whether the server holds it, and how to send it. A
 * selfie needs the live camera (FR-REG-014); ID pages may also come from the
 * phone's photos, the manual route when the camera is refused (FR-VOI-007).
 */
export function PhotoRow({ kind, received, requested, target = false, onUploaded }: Props) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const pendingImage = useRef<PickedImage | null>(null);
  useEffect(() => () => { pendingImage.current = null; }, []);
  const selfie = kind === 'selfie';
  const upload = useApiAction(async (source?: 'camera' | 'library') => {
    if (source) {
      pendingImage.current = null;
      setDenied(false);
      const picked = await pickImage(source, selfie);
      if ('denied' in picked) {
        setDenied(true);
        return;
      }
      if ('cancelled' in picked) return;
      pendingImage.current = picked.image;
    }
    const image = pendingImage.current;
    if (!image) return;
    if (image.byteSize > 10 * 1024 * 1024) {
      pendingImage.current = null;
      throw new ApiError(413, 'too_large', null);
    }
    setProgress({ sent: 0, total: image.byteSize });
    await api().uploadIdentityDocument(kind, image.body, image.contentType, (sent, total) => {
      setProgress({ sent, total });
    });
    pendingImage.current = null;
    setProgress(null);
    onUploaded();
  });
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round(progress.sent / progress.total * 100)) : 0;
  const retryable = Boolean(pendingImage.current) && !(upload.error instanceof ApiError && upload.error.status >= 400 && upload.error.status < 500);

  return (
    <SurfaceCard style={target ? styles.requested : undefined}>
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
      {target ? <AppText step="secondary" tone="secondary">{t('m.setup.nextStep')}</AppText> : null}
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
      {progress && (upload.busy || (upload.error && retryable)) ? (
        <View style={styles.progress}>
          <AppText step="secondary" tone={upload.error ? 'error' : 'secondary'} accessibilityLiveRegion="polite">
            {upload.error ? t('m.verify.uploadInterrupted') : t('m.verify.uploadProgress', { percent })}
          </AppText>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t(`m.verify.${kind}`)}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
        </View>
      ) : null}
      {denied ? <Notice tone="warning">{selfie ? t('m.verify.selfieDenied') : t('m.verify.cameraDenied')}</Notice> : null}
      {upload.error ? (
        <>
          <Notice tone="error">{errorMessage(t, upload.error)}</Notice>
          {retryable ? <Button label={t('m.verify.retryUpload')} variant="secondary" busy={upload.busy} onPress={() => void upload.run()} /> : null}
        </>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  requested: { borderColor: colors.warning },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  actions: { gap: spacing[2] },
  progress: { gap: spacing[1] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary },
});
