import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Screen, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ConsultationNotice } from '@/features/budgeting/ConsultationNotice';
import { CycleCard } from '@/features/budgeting/CycleCard';
import { api } from '@/lib/api';

/**
 * M24 Participatory budgeting: every published cycle, the member's own areas first. Open to
 * everyone; whether a member may vote is decided on the cycle and again at ballot time.
 */
export default function BudgetingScreen() {
  const { t } = useTranslation();
  const cycles = useApiQuery(() => api().listBudgetCycles());
  useReloadOnFocus(cycles.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={cycles.reload}
      refreshing={cycles.loading && cycles.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.budgeting.intro')}
      </AppText>
      <ConsultationNotice />
      <FeatureQueryView feature="budgeting" query={cycles}>
        {(items) => {
          if (items.length === 0) {
            return (
              <AppText step="secondary" tone="muted">
                {t('m.budgeting.none')}
              </AppText>
            );
          }
          const mine = items.filter((cycle) => cycle.inMyArea);
          const others = items.filter((cycle) => !cycle.inMyArea);
          return (
            <View style={styles.list}>
              {mine.length > 0 ? (
                <AppText step="section" accessibilityRole="header">
                  {t('m.budgeting.myArea')}
                </AppText>
              ) : null}
              {mine.map((cycle) => (
                <CycleCard key={cycle.id} cycle={cycle} />
              ))}
              {others.length > 0 ? (
                <AppText step="section" accessibilityRole="header">
                  {t('m.budgeting.otherAreas')}
                </AppText>
              ) : null}
              {others.map((cycle) => (
                <CycleCard key={cycle.id} cycle={cycle} />
              ))}
            </View>
          );
        }}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
