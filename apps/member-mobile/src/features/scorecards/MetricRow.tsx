import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { control, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

import { isRate, type Metric, type MetricKey } from './figures';

type Props = { metric: MetricKey; figure: Metric; period: string };

/**
 * One figure with how it was worked out, always shown under it: numerator of denominator and the
 * quarter (M20, FR-ACS-002). The service levels it was measured against are named once per screen.
 */
export function MetricRow({ metric, figure, period }: Props) {
  const { t } = useTranslation();
  const label = t(`m.scorecards.metric_${metric}`);
  const value =
    figure.value === null
      ? t('m.scorecards.noValue')
      : isRate(metric)
        ? t('m.scorecards.percent', { value: figure.value })
        : metric === 'average_processing_days'
          ? t('m.scorecards.days', { value: figure.value })
          : String(figure.value);
  const parts =
    figure.numerator !== null && figure.denominator !== null
      ? t('m.scorecards.fraction', { numerator: figure.numerator, denominator: figure.denominator })
      : figure.denominator !== null
        ? t('m.scorecards.basedOn', { cases: figure.denominator })
        : t('m.scorecards.countOfCases');
  const how = t('m.scorecards.partsAndPeriod', { parts, period });

  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}. ${how}`}>
      <View style={styles.line}>
        <AppText step="secondary" tone="secondary" style={styles.flex}>
          {label}
        </AppText>
        <AppText step="card">{value}</AppText>
      </View>
      <AppText step="caption" tone="muted">
        {how}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2, minHeight: control.touchMin, justifyContent: 'center', paddingVertical: spacing[1] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
