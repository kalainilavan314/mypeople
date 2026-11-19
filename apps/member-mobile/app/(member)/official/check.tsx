import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, useApiQuery } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CheckResult } from '@/features/official/CheckResult';
import { api } from '@/lib/api';

/**
 * M48 check result: what the signed records say about a code or a check link (FR-AUT-005). Nothing
 * is labelled official unless its signature verifies; anything else may be reported to a fact-checker.
 */
export default function CheckStatementScreen() {
  const { t } = useTranslation();
  const { code = '' } = useLocalSearchParams<{ code?: string }>();
  const result = useApiQuery(() => api().checkOfficialStatement(code), [code]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={result.reload} refreshing={result.loading && result.data !== undefined}>
      <FeatureQueryView feature="official.updates" query={result}>
        {(data) => (
          <>
            <CheckResult result={data} />
            {data.status !== 'verified' ? (
              <Button label={t('m.official.reportThis')} icon="flag-outline" onPress={() => router.push('/official/report')} />
            ) : null}
            <Button
              label={t('m.official.checkAnother')}
              variant="secondary"
              icon="shield-checkmark-outline"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/official'))}
            />
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}
