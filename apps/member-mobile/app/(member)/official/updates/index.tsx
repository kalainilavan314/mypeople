import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Screen, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { OfficialStatementCard } from '@/features/official/OfficialStatementCard';
import { api } from '@/lib/api';

/**
 * M47 Official updates: statements signed by TMK's approved publishers, latest first. The
 * "Official statement" label and publication time appear only on content whose signature verifies
 * (BR-148, FR-AUT-003); withdrawn statements stay listed and say so.
 */
export default function OfficialUpdatesScreen() {
  const { t } = useTranslation();
  const statements = useApiQuery(() => api().listOfficialStatements());
  useReloadOnFocus(statements.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={statements.reload}
      refreshing={statements.loading && statements.data !== undefined}>
      <FeatureQueryView feature="official.updates" query={statements}>
        {(items) => (
          <>
            <AppText step="body" tone="secondary">
              {t('m.official.updatesIntro')}
            </AppText>
            {items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.official.updatesNone')}
              </AppText>
            ) : (
              <View style={styles.list}>
                {items.map((statement) => (
                  <OfficialStatementCard key={statement.id} statement={statement} />
                ))}
              </View>
            )}
            <Button
              label={t('m.official.checkTitle')}
              variant="secondary"
              icon="shield-checkmark-outline"
              onPress={() => router.push('/official')}
            />
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
