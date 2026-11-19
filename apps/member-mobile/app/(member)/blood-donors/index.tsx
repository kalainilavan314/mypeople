import type { BloodDonor } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDate,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { NoticeCard } from '@/features/bloodDonors/NoticeCard';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M37 Blood donor enrolment. Explicit opt-in with a self-declared blood group, a broad area, contact
 * preferences and availability; withdrawal deletes the donor data at once (FR-BLD-001, 007). Donors are
 * never listed or searchable; a hospital sees a donor's contact only after they accept a request
 * (FR-BLD-002, 005). Whether someone can give blood is for health professionals (OS-15).
 */
export default function BloodDonorsScreen() {
  const { t } = useTranslation();
  const home = useApiQuery(() => api().getMyBloodDonor());
  useReloadOnFocus(home.reload);
  const withdraw = useApiAction(async () => {
    await api().withdrawBloodDonor();
    home.reload();
  });

  const confirmWithdraw = () =>
    void confirmAction({
      title: t('m.bloodDonors.withdrawTitle'),
      message: t('m.bloodDonors.withdrawConfirm'),
      confirmLabel: t('m.bloodDonors.withdrawYes'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    }).then((yes) => yes && void withdraw.run());

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={home.reload} refreshing={home.loading && home.data !== undefined}>
      <FeatureQueryView feature="bloodDonors" query={home}>
        {(data) => (
          <View style={styles.body}>
            <Notice tone="info" title={t('m.bloodDonors.medicalTitle')}>
              {t('m.bloodDonors.medicalStatement')}
            </Notice>
            {data.donor ? (
              <DonorCard donor={data.donor} />
            ) : (
              <SurfaceCard style={styles.card}>
                <AppText step="section" accessibilityRole="header">
                  {t('m.bloodDonors.joinHeading')}
                </AppText>
                <AppText step="body" tone="secondary">
                  {t('m.bloodDonors.joinIntro')}
                </AppText>
                <Button label={t('m.bloodDonors.join')} icon="water-outline" onPress={() => router.push('/blood-donors/enrol')} />
              </SurfaceCard>
            )}
            <SurfaceCard style={styles.card}>
              <AppText step="section" accessibilityRole="header">
                {t('m.bloodDonors.privacyHeading')}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {t('m.bloodDonors.privacyBody')}
              </AppText>
            </SurfaceCard>

            {data.donor ? (
              <>
                <AppText step="section" accessibilityRole="header">
                  {t('m.bloodDonors.noticesHeading')}
                </AppText>
                {data.notices.length === 0 ? (
                  <AppText step="secondary" tone="muted">
                    {t('m.bloodDonors.noNotices')}
                  </AppText>
                ) : (
                  data.notices.map((notice) => <NoticeCard key={notice.requestId} notice={notice} />)
                )}
                <Button
                  label={t('m.bloodDonors.change')}
                  variant="secondary"
                  icon="create-outline"
                  onPress={() => router.push('/blood-donors/enrol')}
                />
                {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error, 'bloodDonors')}</Notice> : null}
                <Button
                  label={t('m.bloodDonors.withdraw')}
                  variant="danger"
                  icon="trash-outline"
                  busy={withdraw.busy}
                  onPress={confirmWithdraw}
                />
              </>
            ) : null}
          </View>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

function DonorCard({ donor }: { donor: BloodDonor }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const area = useAreaName(donor.areaKey);
  const paused = donor.available && donor.pausedUntil && new Date(`${donor.pausedUntil}T23:59:59+05:30`) > new Date();
  const status = !donor.available
    ? t('m.bloodDonors.statusOff')
    : paused && donor.pausedUntil
      ? t('m.bloodDonors.statusPaused', { date: formatDate(donor.pausedUntil, language) })
      : t('m.bloodDonors.statusOn');
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.titleRow}>
        <AppText step="section" accessibilityRole="header" style={styles.flex}>
          {t('m.bloodDonors.youAreDonor')}
        </AppText>
        <StatusTag tone={donor.available && !paused ? 'verified' : 'neutral'} label={status} />
      </View>
      <DetailRow label={t('m.bloodDonors.bloodGroup')} value={donor.bloodGroup} />
      <DetailRow label={t('m.bloodDonors.area')} value={area ?? donor.areaKey} />
      <DetailRow label={t('m.bloodDonors.contactName')} value={donor.contactName} />
      <DetailRow label={t('m.bloodDonors.contactPhone')} value={donor.contactPhone} mono />
      <DetailRow
        label={t('m.bloodDonors.contactWays')}
        value={donor.contactMethods.map((method) => t(`m.bloodDonors.method_${method}`)).join(', ')}
      />
      <AppText step="caption" tone="muted">
        {t('m.bloodDonors.consentedOn', { date: formatDate(donor.consentedAt, language) })}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  card: { gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  flex: { flex: 1, minWidth: 0 },
});
