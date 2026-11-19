import type { BudgetCycleSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { useAreaName } from '@/features/area/useAreaName';
import { rupees } from '@/features/proposals/labels';

import { PHASE_TONES } from './labels';

/** One cycle in M24's list: its phase, budget, fund and voting dates; opens the cycle. */
export function CycleCard({ cycle }: { cycle: BudgetCycleSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const areaName = useAreaName(cycle.areaKey);
  const title = localized(cycle.titleEn, cycle.titleTa);
  const phase = t(`m.budgeting.phase_${cycle.phase}`);
  const fund = `${rupees(cycle.budget, language)} · ${t(`m.budgeting.fund_${cycle.fundKind}`)}`;
  const dates = `${formatDate(cycle.votingOpensAt, language)} – ${formatDate(cycle.votingClosesAt, language)}`;

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/budgeting/[id]', params: { id: cycle.id } })}
      accessibilityLabel={`${title}. ${phase}. ${fund}. ${dates}. ${areaName ?? ''}`}
      accessibilityHint={t('m.budgeting.opensCycle')}>
      <View style={styles.tags}>
        <StatusTag label={phase} tone={PHASE_TONES[cycle.phase]} />
      </View>
      <AppText step="card">{title}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {cycle.cycleRef}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {fund}
      </AppText>
      {areaName ? (
        <AppText step="secondary" tone="secondary">
          {areaName}
        </AppText>
      ) : null}
      <AppText step="caption" tone="muted">
        {dates}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] } });
