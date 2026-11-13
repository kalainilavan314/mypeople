import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { IssueCard } from '@/features/issues/IssueCard';
import { IssuesQueryView } from '@/features/issues/IssuesQueryView';
import { api } from '@/lib/api';

/** My reports: every concern the member sent, newest first, each with its status; opens H09. */
export default function MyReportsScreen() {
  const { t } = useTranslation();
  const reports = useApiQuery(() => api().listMyIssueReports());
  useReloadOnFocus(reports.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={reports.reload}
      refreshing={reports.loading && reports.data !== undefined}>
      <IssuesQueryView query={reports}>
        {({ items }) =>
          items.length === 0 ? (
            <SurfaceCard>
              <AppText step="secondary" tone="muted">
                {t('m.issues.mineEmpty')}
              </AppText>
              <Button label={t('m.issues.reportConcern')} icon="megaphone-outline" onPress={() => router.push('/issues/report')} />
            </SurfaceCard>
          ) : (
            <View style={styles.list}>
              {items.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </View>
          )
        }
      </IssuesQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
