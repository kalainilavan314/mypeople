import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { discardImage, pickImage, type PickedImage } from '@/features/identity/pickImage';
import { api } from '@/lib/api';

import { issueErrorMessage } from './issueErrors';
import { LIMITS } from './labels';
import { PhotoThumb } from './PhotoThumb';

type HeldPhoto = { key: string; image: PickedImage };

type Props = {
  issueId: string;
  /** The reporter answering a "return for details" (FR-WEB-016), or anyone adding what they know (FR-RPT-006). */
  mode: 'reply' | 'add';
  onSent: () => void;
};

/**
 * Text and up to two photos for an issue. The case team sees it at once and a moderator checks
 * it before anyone else can (FR-RPT-006). Photos stay in memory until sent; ids of photos already
 * uploaded are remembered, so a retry after a lost connection never sends one twice.
 */
export function AddInformationForm({ issueId, mode, onSent }: Props) {
  const { t } = useTranslation();
  const reply = mode === 'reply';
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<HeldPhoto[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [denied, setDenied] = useState(false);
  // A reply moves the case on and this form gives way, so the screen confirms a reply instead.
  const [sent, setSent] = useState(false);
  const uploaded = useRef(new Map<string, string>());
  const held = useRef<HeldPhoto[]>([]);
  useEffect(() => {
    held.current = photos;
  }, [photos]);

  // Leaving the screen abandons photos that were never sent.
  useEffect(
    () => () => {
      for (const photo of held.current) discardImage(photo.image);
    },
    [],
  );

  const length = body.trim().length;
  const invalid = length < LIMITS.informationMin || length > LIMITS.informationMax;

  const add = useApiAction(async (source: 'camera' | 'library') => {
    setDenied(false);
    const picked = await pickImage(source);
    if ('denied' in picked) {
      setDenied(true);
      return;
    }
    if ('cancelled' in picked) return;
    setPhotos((current) => [...current, { key: Crypto.randomUUID(), image: picked.image }]);
  });

  const remove = (key: string) => {
    const photo = photos.find((item) => item.key === key);
    if (photo) discardImage(photo.image);
    uploaded.current.delete(key);
    setPhotos((current) => current.filter((item) => item.key !== key));
  };

  const send = useApiAction(async () => {
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const photoIds: string[] = [];
    for (const photo of photos) {
      let id = uploaded.current.get(photo.key);
      if (!id) {
        id = (await api().uploadIssueAdditionPhoto(photo.image.body, photo.image.contentType)).id;
        uploaded.current.set(photo.key, id);
      }
      photoIds.push(id);
    }
    await api().addIssueInformation(issueId, body.trim(), photoIds);
    for (const photo of photos) discardImage(photo.image);
    uploaded.current.clear();
    setPhotos([]);
    setBody('');
    setShowErrors(false);
    setSent(!reply);
    onSent();
  });

  return (
    <SurfaceCard style={styles.card}>
      {reply ? null : (
        <AppText step="section" accessibilityRole="header">
          {t('m.issues.addInformation')}
        </AppText>
      )}
      <TextField
        label={reply ? t('m.issues.replyLabel') : t('m.issues.informationLabel')}
        hint={reply ? t('m.issues.replyHint') : t('m.issues.addInformationHint')}
        value={body}
        onChangeText={(text) => {
          setBody(text);
          setSent(false);
        }}
        multiline
        textAlignVertical="top"
        maxLength={LIMITS.informationMax}
        error={showErrors && invalid ? t('m.issues.informationError') : null}
      />

      <AppText step="secondary" tone="muted">
        {t('m.issues.informationPhotosHint', { max: LIMITS.informationPhotos })}
      </AppText>
      {photos.length > 0 ? (
        <View style={styles.thumbs}>
          {photos.map((photo, index) => (
            <PhotoThumb
              key={photo.key}
              uri={photo.image.previewUri}
              number={index + 1}
              uploaded={uploaded.current.has(photo.key)}
              onRemove={send.busy ? undefined : () => remove(photo.key)}
            />
          ))}
        </View>
      ) : null}
      {photos.length < LIMITS.informationPhotos ? (
        <View style={styles.actions}>
          <Button
            label={t('m.issues.takePhoto')}
            icon="camera-outline"
            variant="secondary"
            busy={add.busy}
            disabled={send.busy}
            onPress={() => void add.run('camera')}
          />
          <Button
            label={t('m.issues.choosePhoto')}
            icon="images-outline"
            variant="secondary"
            disabled={add.busy || send.busy}
            onPress={() => void add.run('library')}
          />
        </View>
      ) : null}
      {denied ? <Notice tone="warning">{t('m.issues.cameraDenied')}</Notice> : null}
      {add.error ? <Notice tone="error">{issueErrorMessage(t, add.error)}</Notice> : null}
      {send.error ? <Notice tone="error">{issueErrorMessage(t, send.error)}</Notice> : null}
      {sent ? <Notice tone="success">{t('m.issues.informationSent')}</Notice> : null}

      <Button
        label={reply ? t('m.issues.sendReply') : t('m.issues.sendInformation')}
        icon="send-outline"
        busy={send.busy}
        busyLabel={t('m.common.sending')}
        disabled={add.busy}
        onPress={() => void send.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  actions: { gap: spacing[2] },
});
