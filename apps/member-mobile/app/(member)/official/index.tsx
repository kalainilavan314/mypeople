import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { MisinfoReportCard } from '@/features/official/MisinfoReportCard';
import { api } from '@/lib/api';

/**
 * M48 Check or report a statement: the member's reports with what a fact-checker decided. A person
 * checks every report; there is no automatic score (BR-149). Checking an official statement by its
 * code waits for the signing keys (INT-24), so it is only announced here, not offered.
 */
export default function OfficialStatementsScreen() {
  const { t } = useTranslation();
  const reports = useApiQuery(() => api().listMyMisinfoReports());
  useReloadOnFocus(reports.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={reports.reload} refreshing={reports.loading && reports.data !== undefined}>
      <FeatureQueryView feature="official" query={reports}>
        {(items) => (
          <>
            <SurfaceCard style={styles.card}>
              <AppText step="body" tone="secondary">
                {t('m.official.intro')}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {t('m.official.personChecks')}
              </AppText>
              <Button label={t('m.official.report')} icon="flag-outline" onPress={() => router.push('/official/report')} />
            </SurfaceCard>
            <Notice tone="info">{t('m.official.codeCheckLater')}</Notice>
            <AppText step="section" accessibilityRole="header">
              {t('m.official.myReports')}
            </AppText>
            {items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.official.none')}
              </AppText>
            ) : (
              <View style={styles.list}>
                {items.map((report) => (
                  <MisinfoReportCard key={report.id} report={report} onChanged={reports.reload} />
                ))}
              </View>
            )}
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  list: { gap: spacing[3] },
});
