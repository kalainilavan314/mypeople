import type { MyRenewal, RenewalPhase } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  formatDate,
  MenuRow,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  type Tone,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const PHASE_TONE: Record<RenewalPhase, Tone> = {
  upcoming: 'neutral',
  due: 'pending',
  grace: 'pending',
  lapsed: 'error',
  confirmed: 'verified',
};

/**
 * M33 Membership renewal (FR-RNW-001 to 003, 009, BR-136, OD-43): once a year the member confirms
 * that their mobile number and area are still right. No document, ID photo or selfie is ever asked
 * for. A changed number is confirmed by a code on the recovery-number screen before it counts; a
 * changed area goes through the area-change request. After the 60-day grace period the membership
 * lapses, and confirming here makes it Active again.
 */
export default function RenewalScreen() {
  const { t } = useTranslation();
  const renewal = useApiQuery(() => api().getMyRenewal());
  useReloadOnFocus(renewal.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={renewal.reload}
      refreshing={renewal.loading && renewal.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.renewal.intro')}
      </AppText>
      <FeatureQueryView feature="renewal" query={renewal}>
        {(data) => <RenewalBody data={data} onChanged={renewal.reload} />}
      </FeatureQueryView>
      {renewal.data ? (
        <SurfaceCard style={styles.rowCard}>
          <MenuRow
            first
            icon="ribbon-outline"
            label={t('m.renewal.certificatesRow')}
            hint={t('m.renewal.certificatesHint')}
            onPress={() => router.push('/renewal/certificates' as Href)}
          />
        </SurfaceCard>
      ) : null}
    </Screen>
  );
}

function RenewalBody({ data, onChanged }: { data: MyRenewal; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [done, setDone] = useState<'confirmed' | 'reactivated' | null>(null);

  if (!data.applies || !data.cycle || !data.phase) {
    return <Notice tone="info">{t(`m.renewal.notApplies_${data.reason ?? 'membership_pending'}`)}</Notice>;
  }
  const cycle = data.cycle;
  const phase = data.phase;
  const date = (iso: string) => formatDate(iso, language);

  return (
    <>
      {done ? (
        <Notice tone="success" title={done === 'reactivated' ? t('m.renewal.reactivatedTitle') : t('m.renewal.confirmedTitle')}>
          {t('m.renewal.confirmedBody', { date: date(cycle.dueOn) })}
        </Notice>
      ) : null}

      <SurfaceCard>
        <StatusTag tone={PHASE_TONE[phase]} label={t(`m.renewal.phase_${phase}`)} />
        {phase !== 'lapsed' ? (
          <AppText step="card">{t('m.renewal.dueOn', { date: date(cycle.dueOn) })}</AppText>
        ) : null}
        {phase === 'upcoming' ? (
          <AppText step="secondary" tone="secondary">
            {t('m.renewal.opensOn', { date: date(cycle.opensOn) })}
          </AppText>
        ) : null}
        <AppText step="secondary" tone="muted">
          {t('m.renewal.noDocuments')}
        </AppText>
      </SurfaceCard>

      {phase === 'due' ? <Notice tone="info">{t('m.renewal.dueBanner', { date: date(cycle.dueOn) })}</Notice> : null}
      {phase === 'grace' ? (
        <Notice tone="warning" title={t('m.renewal.phase_grace')}>
          {t('m.renewal.graceBanner', { due: date(cycle.dueOn), end: date(cycle.graceEndsOn) })}
        </Notice>
      ) : null}
      {phase === 'lapsed' ? (
        <Notice tone="error" title={t('m.renewal.phase_lapsed')}>
          {t('m.renewal.lapsedBanner')}
        </Notice>
      ) : null}

      {data.canConfirm ? (
        <ConfirmForm
          data={data}
          onConfirmed={() => {
            setDone(data.reactivation ? 'reactivated' : 'confirmed');
            onChanged();
          }}
        />
      ) : null}

      {data.history.length > 0 ? (
        <SurfaceCard>
          <AppText step="section" accessibilityRole="header">
            {t('m.renewal.history')}
          </AppText>
          {data.history.map((past) => (
            <AppText key={past.id} step="secondary" tone="secondary">
              {past.state === 'confirmed' && past.confirmedAt
                ? t('m.renewal.history_confirmed', { date: date(past.confirmedAt) })
                : past.lapsedAt
                  ? t('m.renewal.history_lapsed', { date: date(past.lapsedAt) })
                  : t('m.renewal.dueOn', { date: date(past.dueOn) })}
            </AppText>
          ))}
        </SurfaceCard>
      ) : null}
    </>
  );
}

/** FR-RNW-001: the mobile number and the area, and nothing else. */
function ConfirmForm({ data, onConfirmed }: { data: MyRenewal; onConfirmed: () => void }) {
  const { t } = useTranslation();
  const [contact, setContact] = useState(false);
  const [area, setArea] = useState(false);
  const confirm = useApiAction(async () => {
    await api().confirmRenewal(contact, area);
    onConfirmed();
  });
  const areaAnswered = area || data.areaChangeOpen;
  const ready = data.contactOnRecord && contact && areaAnswered;

  return (
    <>
      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.renewal.contactTitle')}
        </AppText>
        {data.contactOnRecord && data.mobileMasked ? (
          <>
            <AppText step="page" mono>
              {data.mobileMasked}
            </AppText>
            <Checkbox label={t('m.renewal.contactStill')} checked={contact} onChange={setContact} />
            <Button
              label={t('m.renewal.changeNumber')}
              variant="quiet"
              icon="call-outline"
              accessibilityHint={t('m.renewal.changeNumberHint')}
              onPress={() => router.push('/profile/recovery-number')}
            />
          </>
        ) : (
          <>
            <Notice tone="warning">{t('m.renewal.contactMissing')}</Notice>
            <Button label={t('m.renewal.confirmNumber')} icon="call-outline" onPress={() => router.push('/profile/recovery-number')} />
          </>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.renewal.areaTitle')}
        </AppText>
        <View style={styles.details}>
          <DetailRow label={t('m.renewal.district')} value={data.districtName ?? t('m.renewal.notGiven')} />
          <DetailRow label={t('m.renewal.ds')} value={data.dsName ?? t('m.renewal.notGiven')} />
          <DetailRow label={t('m.renewal.gn')} value={data.gnName ?? t('m.renewal.notGiven')} />
        </View>
        {data.areaChangeOpen ? (
          <Notice tone="info">{t('m.renewal.areaChangeOpen')}</Notice>
        ) : (
          <>
            <Checkbox label={t('m.renewal.areaStill')} checked={area} onChange={setArea} />
            <Button
              label={t('m.renewal.changeArea')}
              variant="quiet"
              icon="location-outline"
              onPress={() => router.push('/profile/area')}
            />
          </>
        )}
      </SurfaceCard>

      {confirm.error ? <Notice tone="error">{errorMessage(t, confirm.error, 'renewal')}</Notice> : null}
      <Button
        label={data.reactivation ? t('m.renewal.reactivate') : t('m.renewal.confirm')}
        icon="checkmark-circle-outline"
        busy={confirm.busy}
        busyLabel={t('m.common.sending')}
        disabled={!ready}
        onPress={() => void confirm.run()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  rowCard: { paddingVertical: 0 },
  details: { gap: spacing[2] },
});
