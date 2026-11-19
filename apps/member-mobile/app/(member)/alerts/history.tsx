import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Screen, useApiQuery } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { AlertCard } from '@/features/safety/AlertCard';
import { api } from '@/lib/api';

/** FR-DIS-008: alerts past their source's end time or withdrawn by it, from the last 90 days. */
export default function AlertHistoryScreen() {
  const { t } = useTranslation();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const history = useApiQuery(() => api().getAlertHistory(area || undefined), [area]);

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={history.reload} refreshing={history.loading && history.data !== undefined}>
      <AppText step="secondary" tone="secondary">
        {t('m.safety.historyIntro')}
      </AppText>
      <FeatureQueryView feature="safety" query={history}>
        {(alerts) =>
          alerts.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.safety.noHistory')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} showState />
              ))}
            </View>
          )
        }
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
