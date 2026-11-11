import type { Broadcast, ManagedAlbum, QueuedAreaChange, QueuedRemoval } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { radius, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  AuthorizedImage,
  Button,
  formatDateTime,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Done = { onDone: () => void };

function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return <TextField label={t('s.common.reason')} hint={t('s.common.reasonHint')} value={value} onChangeText={onChange} multiline maxLength={500} />;
}

/** FR-ADM-007: a broadcast wider than a district, approved by someone senior who did not submit it. */
export function BroadcastItem({ broadcast, onDone }: { broadcast: Broadcast } & Done) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const approve = useApiAction(async () => {
    await api().approveBroadcast(broadcast.id);
    onDone();
  });
  return (
    <SurfaceCard>
      <AppText step="card">{localized(broadcast.titleEn, broadcast.titleTa)}</AppText>
      <AppText step="secondary" tone="secondary">
        {localized(broadcast.bodyEn, broadcast.bodyTa)}
      </AppText>
      <AppText step="caption" tone="muted" mono>
        {`${broadcast.broadcastRef} · ${broadcast.areaKey}`}
      </AppText>
      {broadcast.topic === 'emergency' ? <StatusTag tone="error" label={t('s.approvals.emergency')} /> : null}
      {approve.error ? <Notice tone="error">{errorMessage(t, approve.error)}</Notice> : null}
      <Button label={t('s.approvals.approve')} busy={approve.busy} onPress={() => void approve.run()} />
    </SurfaceCard>
  );
}

/** FR-PROF-009: a move to another GN division, decided by a reviewer of the new area with the proof open. */
export function AreaChangeItem({ change, onDone }: { change: QueuedAreaChange } & Done) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const decide = useApiAction(async (decision: 'approve' | 'decline') => {
    await api().decideAreaChange(change.id, { decision, reason: reason.trim() });
    onDone();
  });
  return (
    <SurfaceCard>
      <AppText step="card">{t('s.approvals.to', { to: change.toGnName })}</AppText>
      {change.fromGn ? (
        <AppText step="secondary" tone="muted">
          {t('s.approvals.from', { from: change.fromGnName ?? change.fromGn })}
        </AppText>
      ) : null}
      <AppText step="caption" tone="muted" mono>
        {change.requestRef}
      </AppText>
      {change.hasProof ? (
        <AuthorizedImage
          uri={api().areaChangeProofUrl(change.id)}
          alt={t('s.approvals.proof')}
          unavailableLabel={t('s.errors.not_found')}
          resizeMode="contain"
          style={styles.proof}
        />
      ) : null}
      <ReasonField value={reason} onChange={setReason} />
      {decide.error ? <Notice tone="error">{errorMessage(t, decide.error)}</Notice> : null}
      <Button label={t('s.approvals.approve')} busy={decide.busy} disabled={reason.trim().length < 3} onPress={() => void decide.run('approve')} />
      <Button label={t('s.approvals.decline')} variant="danger" disabled={decide.busy || reason.trim().length < 3} onPress={() => void decide.run('decline')} />
    </SurfaceCard>
  );
}

/** FR-ADM-005: a second person publishes the album, or returns it with a note. */
export function AlbumItem({ album, onDone }: { album: ManagedAlbum } & Done) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [note, setNote] = useState('');
  const publish = useApiAction(async () => {
    await api().publishAlbum(album.id);
    onDone();
  });
  const giveBack = useApiAction(async () => {
    await api().returnAlbum(album.id, note.trim());
    onDone();
  });
  const failed = publish.error ?? giveBack.error;
  return (
    <SurfaceCard>
      <AppText step="card">{localized(album.titleEn, album.titleTa)}</AppText>
      <AppText step="secondary" tone="secondary">
        {localized(album.summaryEn, album.summaryTa)}
      </AppText>
      <AppText step="caption" tone="muted" mono>
        {`${album.albumRef} · ${album.photoCount}`}
      </AppText>
      <View style={styles.photos}>
        {album.photos.map((photo) => (
          <View key={photo.id} style={styles.photo}>
            <AuthorizedImage
              uri={api().galleryPhotoUrl(photo.id, 'thumb')}
              alt={localized(photo.captionEn, photo.captionTa)}
              unavailableLabel={t('s.approvals.photo')}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </View>
      {failed ? <Notice tone="error">{errorMessage(t, failed)}</Notice> : null}
      <Button label={t('s.approvals.publish')} busy={publish.busy} disabled={giveBack.busy} onPress={() => void publish.run()} />
      <ReasonField value={note} onChange={setNote} />
      <Button
        label={t('s.approvals.return')}
        variant="secondary"
        busy={giveBack.busy}
        disabled={publish.busy || note.trim().length < 3}
        onPress={() => void giveBack.run()}
      />
    </SurfaceCard>
  );
}

/** FR-GAL-007, FR-ADM-006: a photo removal request answered within 24 hours, with a reason. */
export function RemovalItem({ request, onDone }: { request: QueuedRemoval } & Done) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [reason, setReason] = useState('');
  const decide = useApiAction(async (decision: 'remove' | 'blur' | 'keep') => {
    await api().decideRemovalRequest(request.id, { decision, reason: reason.trim() });
    onDone();
  });
  const ready = reason.trim().length >= 3;
  return (
    <SurfaceCard>
      <View style={styles.titleRow}>
        <AppText step="card" style={styles.flex}>
          {t(`s.approvals.reason_${request.reason}`)}
        </AppText>
        {request.escalated ? <StatusTag tone="error" label={t('s.approvals.escalated')} /> : null}
      </View>
      {request.note ? (
        <AppText step="secondary" tone="secondary">
          {request.note}
        </AppText>
      ) : null}
      <AppText step="caption" tone="muted" mono>
        {`${request.requestRef} · ${request.albumRef} · ${t('s.approvals.due', { time: formatDateTime(request.dueAt, language) })}`}
      </AppText>
      <View style={styles.single}>
        <AuthorizedImage
          uri={api().galleryPhotoUrl(request.photoId, 'display')}
          alt={t('s.approvals.photo')}
          unavailableLabel={t('s.approvals.photo')}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ReasonField value={reason} onChange={setReason} />
      {decide.error ? <Notice tone="error">{errorMessage(t, decide.error)}</Notice> : null}
      <Button label={t('s.approvals.remove')} variant="danger" busy={decide.busy} disabled={!ready} onPress={() => void decide.run('remove')} />
      <Button label={t('s.approvals.blur')} variant="secondary" disabled={!ready || decide.busy} onPress={() => void decide.run('blur')} />
      <Button label={t('s.approvals.keep')} variant="secondary" disabled={!ready || decide.busy} onPress={() => void decide.run('keep')} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  proof: { width: '100%', height: 240, borderRadius: radius.control },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  photo: { width: 72, height: 72, borderRadius: radius.control, overflow: 'hidden' },
  single: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.control, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
