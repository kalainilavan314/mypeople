import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, MenuRow, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CheckForm } from '@/features/official/CheckForm';
import { MisinfoReportCard } from '@/features/official/MisinfoReportCard';
import { api } from '@/lib/api';

/**
 * M48 Check or report a statement. Checking a code or link against the signed records
 * (official_content, FR-AUT-005) opens the result; reporting suspected misinformation and the
 * member's reports with what a fact-checker decided (fact_checks) follow. A person checks every
 * report; there is no automatic score (BR-149). Each part says "not open yet" on its own while
 * its switch is off.
 */
export default function OfficialStatementsScreen() {
  const { t } = useTranslation();
  const reports = useApiQuery(() => api().listMyMisinfoReports());
  useReloadOnFocus(reports.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={reports.reload} refreshing={reports.loading && reports.data !== undefined}>
      <CheckForm onCheck={(code) => router.push({ pathname: '/official/check', params: { code } })} />
      <SurfaceCard style={styles.rows}>
        <MenuRow
          first
          icon="document-text-outline"
          tint="blue"
          label={t('m.official.updatesTitle')}
          hint={t('m.official.updatesHint')}
          onPress={() => router.push('/official/updates')}
        />
      </SurfaceCard>
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
  rows: { paddingVertical: 0 },
});
