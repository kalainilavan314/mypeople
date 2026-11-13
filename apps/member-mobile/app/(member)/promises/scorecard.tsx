import type { AreaScorecard } from '@my-people/api-client';
import { areaName } from '@my-people/i18n/staff-terms';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDate,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { METRICS, readFigures } from '@/features/scorecards/figures';
import { MetricRow } from '@/features/scorecards/MetricRow';
import { api } from '@/lib/api';

/**
 * M20 Area scorecard: the member's GN division, DS division and district, each with its last four
 * published quarters. Every value shows its numerator, denominator and quarter (M20). Under 10
 * accepted cases an area shows "Insufficient data", never figures that could single anyone out; no
 * person is named (FR-ACS-001 to 004).
 */
export default function ScorecardScreen() {
  const { t } = useTranslation();
  const scorecards = useApiQuery(() => api().getMyScorecards());
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={scorecards.reload}
      refreshing={scorecards.loading && scorecards.data !== undefined}>
      <FeatureQueryView feature="scorecards" query={scorecards}>
        {(data) => (
          <>
            <AppText step="body" tone="secondary">
              {t('m.scorecards.intro')}
            </AppText>
            {data.areas.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.scorecards.noArea')}
              </AppText>
            ) : (
              data.areas.map((area) => <AreaCard key={area.areaKey} area={area} />)
            )}
            <AppText step="caption" tone="muted">
              {t('m.scorecards.slaVersion', { version: data.slaVersion })}
            </AppText>
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

function AreaCard({ area }: { area: AreaScorecard }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const name = area.nameEn ? localized(area.nameEn, area.nameTa ?? '') : areaName(area.areaKey, undefined, language);
  const level = area.areaKey.split(':')[0];
  const periods = [...area.periods].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 4);

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="caption" tone="primary">
        {t(`m.scorecards.level_${level}`, { defaultValue: level })}
      </AppText>
      <AppText step="section" accessibilityRole="header">
        {name}
      </AppText>
      {periods.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.scorecards.noPeriods')}
        </AppText>
      ) : (
        periods.map((period) => {
          const figures = readFigures(period.figures);
          const note = period.noteEn ? localized(period.noteEn, period.noteTa ?? '') : null;
          return (
            <View key={period.period} style={styles.period}>
              <AppText step="card">{t('m.scorecards.period', { period: period.period })}</AppText>
              {period.publishedAt ? (
                <AppText step="caption" tone="muted">
                  {t('m.scorecards.publishedOn', { date: formatDate(period.publishedAt, language), version: period.version })}
                </AppText>
              ) : null}
              {figures.insufficient ? (
                <>
                  <StatusTag tone="neutral" label={t('m.scorecards.insufficient')} />
                  <AppText step="secondary" tone="muted">
                    {t('m.scorecards.insufficientBody')}
                  </AppText>
                </>
              ) : (
                METRICS.map((metric) => {
                  const figure = figures.metrics[metric];
                  return figure ? (
                    <MetricRow key={metric} metric={metric} figure={figure} period={period.period} />
                  ) : null;
                })
              )}
              {note ? (
                <View style={styles.note}>
                  <AppText step="label">{t('m.scorecards.context')}</AppText>
                  <AppText step="secondary" tone="secondary">
                    {note}
                  </AppText>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  period: { gap: spacing[1], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
  note: { gap: 2, paddingTop: spacing[1] },
});
