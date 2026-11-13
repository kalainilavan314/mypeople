import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

import { isRate, type Metric, type MetricKey } from './figures';

type Props = { metric: MetricKey; figure: Metric; period: string; slaVersion: string };

/**
 * One figure with how it was worked out behind an info toggle: numerator ÷ denominator, the period
 * and the SLA version it was measured against (FR-ACS-002).
 */
export function MetricRow({ metric, figure, period, slaVersion }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => setOpen((shown) => !shown)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint={t('m.scorecards.howHint')}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={styles.line}>
        <AppText step="secondary" tone="secondary" style={styles.flex}>
          {label}
        </AppText>
        <AppText step="card">{value}</AppText>
        <Ionicons
          accessible={false}
          name={open ? 'information-circle' : 'information-circle-outline'}
          size={20}
          color={colors.link}
        />
      </Pressable>
      {open ? (
        <AppText step="caption" tone="muted">
          {t('m.scorecards.how', { parts, period, version: slaVersion })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: control.touchMin },
  flex: { flex: 1 },
});
