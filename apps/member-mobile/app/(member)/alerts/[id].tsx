import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ALERT_STATE_TONES, SEVERITY_TONES } from '@/features/safety/labels';
import { NotDispatchNotice } from '@/features/safety/NotDispatchNotice';
import { EmergencyNumbers } from '@/features/support/EmergencyNumbers';
import { api } from '@/lib/api';

/**
 * One official warning (FR-DIS-001, 003, 008): the source's own words, its name, link and issue time,
 * the end time, when it was last checked, and the emergency numbers with the statement that this app
 * sends no help. An alert past its end time or withdrawn by its source is kept as history.
 */
export default function AlertScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const { id } = useLocalSearchParams<{ id: string }>();
  const alert = useApiQuery(() => api().getAlert(id), [id]);

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={alert.reload} refreshing={alert.loading && alert.data !== undefined}>
      <FeatureQueryView feature="safety" query={alert}>
        {(data) => (
          <View style={styles.body}>
            <View style={styles.tags}>
              <StatusTag tone={SEVERITY_TONES[data.severity]} label={t(`m.safety.severity_${data.severity}`)} />
              <StatusTag tone="neutral" label={t(`m.safety.hazard_${data.hazard}`)} />
              <StatusTag tone={ALERT_STATE_TONES[data.state]} label={t(`m.safety.state_${data.state}`)} />
            </View>
            <AppText step="page" accessibilityRole="header">
              {localized(data.titleEn, data.titleTa)}
            </AppText>
            {data.state === 'withdrawn' ? (
              <Notice tone="info" title={t('m.safety.withdrawnTitle')}>
                {data.withdrawnReason ?? ''}
              </Notice>
            ) : null}
            {data.state === 'expired' ? <Notice tone="info">{t('m.safety.expiredBody')}</Notice> : null}
            {data.stale ? (
              <Notice tone="warning" title={t('m.safety.staleTitle')}>
                {t('m.safety.staleBody')}
              </Notice>
            ) : null}
            <SurfaceCard style={styles.card}>
              <AppText step="body">{localized(data.bodyEn, data.bodyTa)}</AppText>
            </SurfaceCard>
            <SurfaceCard style={styles.rows}>
              <DetailRow label={t('m.safety.source')} value={localized(data.sourceNameEn, data.sourceNameTa)} />
              <DetailRow label={t('m.safety.issued')} value={formatDateTime(data.sourceIssuedAt, language)} />
              <DetailRow
                label={data.state === 'current' ? t('m.safety.endsAt') : t('m.safety.endedAt')}
                value={formatDateTime(data.sourceEndsAt, language)}
              />
              <DetailRow label={t('m.safety.lastChecked')} value={formatDateTime(data.refreshedAt, language)} />
              <DetailRow label={t('m.safety.reference')} value={data.alertRef} mono />
            </SurfaceCard>
            <Button
              label={t('m.safety.openSource')}
              variant="secondary"
              icon="open-outline"
              accessibilityHint={t('m.safety.openSourceHint')}
              onPress={() => void Linking.openURL(data.sourceUrl)}
            />
            <NotDispatchNotice />
            <EmergencyNumbers contacts={data.emergencyContacts} lead={t('m.safety.emergencyLead')} />
            {data.state === 'current' ? (
              <Button
                label={t('m.safety.askForHelp')}
                icon="alert-circle-outline"
                onPress={() => router.push({ pathname: '/alerts/help', params: { alertId: data.id } })}
              />
            ) : null}
          </View>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[2] },
  rows: { gap: spacing[2] },
});
