import { ApiError, type IdentityDocumentKind } from '@my-people/api-client';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import { AppText, Button, Notice, StatusTag, SurfaceCard, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage, noAnswer } from '@/lib/errors';

import { discardImage, pickImage, type PickedImage } from './pickImage';

type Props = {
  kind: IdentityDocumentKind;
  received: boolean;
  /** Named by the reviewer in a correction request. */
  requested: boolean;
  /** The step the member should do next (A18), highlighted. */
  target?: boolean;
  onUploaded: () => void;
};

type Next = { source: 'camera' | 'library' } | { image: PickedImage };

type Advice = 'blurry' | 'too_dark' | 'glare' | 'too_small';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // the API's limit (FR-REG-010), checked before anything is sent

/**
 * One identity image: whether the server holds it, and how to send it. A
 * selfie needs the live camera (FR-REG-014); ID pages may also come from the
 * phone's photos, the manual route when the camera is refused (FR-VOI-007).
 *
 * A17: only a photo the server acknowledged counts as received (BR-020). While
 * it uploads a progress bar shows how much is sent. When an upload is
 * interrupted the row says so and keeps the photo, in memory and the app's
 * private cache, so "Retry upload" sends the same photo without taking it
 * again (FR-REG-034). The cached copy is deleted once the server has it, or
 * when it is replaced or the screen is left (FR-REG-035).
 *
 * M01: after an upload the server's capture advice (blur, darkness, glare,
 * size) is shown under the photo. The photo still counts as received; the
 * member decides whether to retake it (FR-IDV-001, BR-091).
 */
export function PhotoRow({ kind, received, requested, target = false, onUploaded }: Props) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const [held, setHeld] = useState<PickedImage | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  // M01: what the server noticed about the photo it just received; advice only, it still counts.
  const [advice, setAdvice] = useState<Advice[]>([]);
  const heldRef = useRef<PickedImage | null>(null);
  const selfie = kind === 'selfie';

  const hold = (image: PickedImage | null) => {
    if (heldRef.current && heldRef.current !== image) discardImage(heldRef.current);
    heldRef.current = image;
    setHeld(image);
  };

  // Leaving the screen abandons a photo that was never sent.
  useEffect(
    () => () => {
      if (heldRef.current) discardImage(heldRef.current);
    },
    [],
  );

  const upload = useApiAction(async (next: Next) => {
    let image: PickedImage;
    if ('image' in next) {
      image = next.image;
    } else {
      setDenied(false);
      const picked = await pickImage(next.source, selfie);
      if ('denied' in picked) {
        setDenied(true);
        return;
      }
      if ('cancelled' in picked) return;
      hold(picked.image);
      image = picked.image;
    }
    setInterrupted(false);
    setAdvice([]);
    if (image.body.size > MAX_IMAGE_BYTES) {
      hold(null);
      throw new ApiError(413, 'too_large', null);
    }
    setProgress({ sent: 0, total: image.body.size });
    try {
      const stored = await api().uploadIdentityDocument(kind, image.body, image.contentType, (sent, total) => {
        setProgress({ sent, total });
      });
      setAdvice(stored.quality?.problems ?? []);
    } catch (error) {
      if (noAnswer(error)) setInterrupted(true);
      else hold(null); // refused (wrong type, too large): the same file cannot succeed
      throw error;
    } finally {
      setProgress(null);
    }
    hold(null);
    onUploaded();
  });

  const showInterrupted = interrupted && held !== null;
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.sent / progress.total) * 100)) : 0;

  return (
    <SurfaceCard style={(requested || target || showInterrupted) && styles.attention}>
      <View style={styles.header}>
        <AppText step="card" style={styles.flex}>
          {t(`m.verify.${kind}`)}
        </AppText>
        {showInterrupted ? (
          <StatusTag tone="error" label={t('m.verify.notReceived')} />
        ) : requested ? (
          <StatusTag tone="pending" label={t('m.verify.status_needs_update')} />
        ) : (
          <StatusTag tone={received ? 'verified' : 'neutral'} label={received ? t('m.verify.received') : t('m.verify.needed')} />
        )}
      </View>
      {target ? (
        <AppText step="secondary" tone="secondary">
          {t('m.setup.nextStep')}
        </AppText>
      ) : null}
      {selfie ? (
        <AppText step="secondary" tone="muted">
          {t('m.verify.selfieCameraOnly')}
        </AppText>
      ) : null}

      {progress && upload.busy ? (
        <View style={styles.progress}>
          <AppText step="secondary" tone="secondary" accessibilityLiveRegion="polite">
            {t('m.verify.uploadProgress', { percent })}
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

      {showInterrupted ? (
        <>
          <Notice tone="warning" title={t('m.verify.interruptedTitle')}>
            {t('m.verify.interruptedBody')}
          </Notice>
          <Button
            label={t('m.verify.retryUpload')}
            icon="refresh-outline"
            busy={upload.busy}
            busyLabel={t('m.verify.uploading')}
            onPress={() => {
              if (held) void upload.run({ image: held });
            }}
          />
        </>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={received && !requested ? t('m.verify.replace') : t('m.verify.takePhoto')}
          icon="camera-outline"
          variant={showInterrupted || (received && !requested) ? 'secondary' : 'primary'}
          busy={upload.busy && !showInterrupted}
          busyLabel={t('m.verify.uploading')}
          disabled={upload.busy && showInterrupted}
          onPress={() => void upload.run({ source: 'camera' })}
        />
        {!selfie ? (
          <Button
            label={t('m.verify.choosePhoto')}
            icon="images-outline"
            variant="secondary"
            disabled={upload.busy}
            onPress={() => void upload.run({ source: 'library' })}
          />
        ) : null}
      </View>
      {denied ? <Notice tone="warning">{selfie ? t('m.verify.selfieDenied') : t('m.verify.cameraDenied')}</Notice> : null}
      {advice.length > 0 && !upload.busy ? (
        <Notice tone="warning" title={t('m.verify.adviceTitle')}>
          {advice.map((problem) => t(`m.verify.advice_${problem}`)).join('\n')}
        </Notice>
      ) : null}
      {upload.error && !showInterrupted ? <Notice tone="error">{errorMessage(t, upload.error)}</Notice> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  attention: { borderColor: colors.warning },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  actions: { gap: spacing[2] },
  progress: { gap: spacing[1] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary },
});
