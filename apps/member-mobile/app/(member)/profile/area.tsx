import type { AreaChange, ProfileView } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { AreaFields, NO_AREA } from '@/features/area/AreaFields';
import { pickImage } from '@/features/identity/pickImage';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * My area, and moving to another GN division (FR-PROF-009): a request, proof
 * of residence (kept in the encrypted evidence store), and a decision by a
 * reviewer of the new area. The proof may be a photo or a picture already on
 * the phone (FR-VOI-007).
 */
export default function AreaScreen() {
  const profile = useApiQuery(() => api().getProfile());
  return (
    <Screen edges={['bottom']} onRefresh={profile.reload} refreshing={profile.loading && profile.data !== undefined}>
      <QueryView query={profile}>{(data) => <AreaBody profile={data} reload={profile.reload} />}</QueryView>
    </Screen>
  );
}

function AreaBody({ profile, reload }: { profile: ProfileView; reload: () => void }) {
  const { t } = useTranslation();
  const lines = [
    [t('m.register.district'), profile.districtName],
    [t('m.register.ds'), profile.dsName],
    [t('m.register.gn'), profile.gnName],
  ].filter((line): line is [string, string] => Boolean(line[1]));

  return (
    <>
      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.profile.areaCurrent')}
        </AppText>
        {lines.map(([label, value]) => (
          <View key={label} style={styles.line}>
            <AppText step="label">{label}</AppText>
            <AppText step="body" tone="secondary">
              {value}
            </AppText>
          </View>
        ))}
      </SurfaceCard>
      {profile.openAreaChange ? (
        <OpenChange change={profile.openAreaChange} reload={reload} />
      ) : (
        <NewChange onCreated={reload} />
      )}
    </>
  );
}

function OpenChange({ change, reload }: { change: AreaChange; reload: () => void }) {
  const { t } = useTranslation();
  const proof = useApiAction(async (source: 'camera' | 'library') => {
    const picked = await pickImage(source);
    if (!('image' in picked)) return;
    await api().uploadAreaChangeProof(change.id, picked.image.body, picked.image.contentType);
    reload();
  });
  const withdraw = useApiAction(async () => {
    await api().withdrawAreaChange(change.id);
    reload();
  });
  return (
    <SurfaceCard accent>
      <AppText step="card">{`${t('m.profile.areaChange')}: ${change.toGnName}`}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {change.requestRef}
      </AppText>
      <StatusTag tone="pending" label={t(`m.profile.areaState_${change.state}`)} />
      {change.state === 'awaiting_proof' ? (
        <>
          <Button label={t('m.verify.takePhoto')} icon="camera-outline" busy={proof.busy} busyLabel={t('m.verify.uploading')} onPress={() => void proof.run('camera')} />
          <Button label={t('m.verify.choosePhoto')} icon="images-outline" variant="secondary" disabled={proof.busy} onPress={() => void proof.run('library')} />
        </>
      ) : null}
      {proof.error ? <Notice tone="error">{errorMessage(t, proof.error)}</Notice> : null}
      {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error)}</Notice> : null}
      <Button label={t('m.profile.areaWithdraw')} variant="danger" busy={withdraw.busy} onPress={() => void withdraw.run()} />
    </SurfaceCard>
  );
}

function NewChange({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState(NO_AREA);
  const request = useApiAction(async () => {
    if (!area.gn) return;
    await api().requestAreaChange(area.gn);
    onCreated();
  });
  if (!open) return <Button label={t('m.profile.areaChange')} variant="secondary" icon="swap-horizontal-outline" onPress={() => setOpen(true)} />;
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.areaChange')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.profile.areaChangeHint')}
      </AppText>
      <AreaFields value={area} onChange={setArea} />
      {request.error ? <Notice tone="error">{errorMessage(t, request.error)}</Notice> : null}
      <Button label={t('m.common.continue')} busy={request.busy} disabled={!area.gn} onPress={() => void request.run()} />
      <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setOpen(false)} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ line: { gap: 2, paddingVertical: spacing[1] } });
