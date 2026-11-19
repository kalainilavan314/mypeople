import type { DisasterAlert } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDateTime, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { ALERT_STATE_TONES, SEVERITY_TONES } from './labels';

/**
 * One relayed warning in M35: how serious, what hazard, the official source and its issue time (FR-DIS-001),
 * until when, and a flag when nobody has re-checked the source for 6 hours (FR-DIS-008). Opens the alert.
 */
export function AlertCard({ alert, showState = false }: { alert: DisasterAlert; showState?: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(alert.titleEn, alert.titleTa);
  const severity = t(`m.safety.severity_${alert.severity}`);
  const hazard = t(`m.safety.hazard_${alert.hazard}`);
  const source = t('m.safety.fromSource', {
    source: localized(alert.sourceNameEn, alert.sourceNameTa),
    time: formatDateTime(alert.sourceIssuedAt, language),
  });
  const until =
    alert.state === 'withdrawn'
      ? t('m.safety.withdrawnShort')
      : t(alert.state === 'current' ? 'm.safety.until' : 'm.safety.ended', {
          time: formatDateTime(alert.sourceEndsAt, language),
        });

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/alerts/[id]', params: { id: alert.id } })}
      accessibilityLabel={`${severity}. ${hazard}. ${title}. ${source}. ${until}`}
      accessibilityHint={t('m.safety.opensAlert')}>
      <View style={styles.tags}>
        <StatusTag tone={SEVERITY_TONES[alert.severity]} label={severity} />
        <StatusTag tone="neutral" label={hazard} />
        {showState ? <StatusTag tone={ALERT_STATE_TONES[alert.state]} label={t(`m.safety.state_${alert.state}`)} /> : null}
      </View>
      <AppText step="card">{title}</AppText>
      <AppText step="secondary" tone="secondary">
        {source}
      </AppText>
      <AppText step="caption" tone="muted">
        {until}
      </AppText>
      {alert.stale ? (
        <AppText step="secondary" tone="warning">
          {t('m.safety.staleShort')}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] } });
