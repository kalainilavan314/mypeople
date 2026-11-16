import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Screen, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { SurveyCard } from '@/features/surveys/SurveyCard';
import { api } from '@/lib/api';

/** Surveys open to the member, each with its audience; answered ones show their receipt. */
export default function SurveysScreen() {
  const { t } = useTranslation();
  const surveys = useApiQuery(() => api().listSurveys());
  useReloadOnFocus(surveys.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={surveys.reload}
      refreshing={surveys.loading && surveys.data !== undefined}>
      <FeatureQueryView feature="surveys" query={surveys}>
        {(items) => (
          <>
            <AppText step="body" tone="secondary">
              {t('m.surveys.intro')}
            </AppText>
            {items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.surveys.none')}
              </AppText>
            ) : (
              <View style={styles.list}>
                {items.map((survey) => (
                  <SurveyCard key={survey.id} survey={survey} />
                ))}
              </View>
            )}
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
