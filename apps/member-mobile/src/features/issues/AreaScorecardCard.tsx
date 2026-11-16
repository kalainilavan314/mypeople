import type { AreaScorecard } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, StatusTag, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { readFigures } from '@/features/scorecards/figures';
import { MetricRow } from '@/features/scorecards/MetricRow';
import { api } from '@/lib/api';

const SHOWN = ['resolution_rate', 'on_time_rate'] as const;

/** The member's own GN division and its latest published quarter, if there is one. */
function latestGnPeriod(areas: readonly AreaScorecard[]) {
  const gn = areas.find((area) => area.areaKey.startsWith('gn:'));
  const published = (gn?.periods ?? []).filter((period) => period.publishedAt !== null);
  return [...published].sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
}

/**
 * H05 shows the area scorecard (M20) in brief: the GN division's resolution and on-time rates for the
 * latest published quarter, each with its numerator and denominator, or "Insufficient data" under 10
 * accepted cases. It stays hidden while scorecards are switched off (404 feature_unavailable), before
 * the first published quarter, or when the figures cannot be loaded: My area works without it.
 */
export function AreaScorecardCard() {
  const { t } = useTranslation();
  const scorecards = useApiQuery(() => api().getMyScorecards());
  useReloadOnFocus(scorecards.reload);
  if (!scorecards.data) return null;
  const period = latestGnPeriod(scorecards.data.areas);
  if (!period) return null;
  const figures = readFigures(period.figures);

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.issues.scorecardTitle')}
      </AppText>
      <AppText step="caption" tone="muted">
        {t('m.scorecards.period', { period: period.period })}
      </AppText>
      {figures.insufficient ? (
        <>
          <StatusTag tone="neutral" label={t('m.scorecards.insufficient')} />
          <AppText step="secondary" tone="muted">
            {t('m.scorecards.insufficientBody')}
          </AppText>
        </>
      ) : (
        SHOWN.map((metric) => {
          const figure = figures.metrics[metric];
          return figure ? <MetricRow key={metric} metric={metric} figure={figure} period={period.period} /> : null;
        })
      )}
      <Button
        label={t('m.issues.scorecardOpen')}
        variant="secondary"
        icon="stats-chart-outline"
        onPress={() => router.push('/promises/scorecard')}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
});
