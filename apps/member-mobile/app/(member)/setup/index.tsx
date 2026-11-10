import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';
import { AppText, Button, Screen, StatusTag, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** A18: the API owns completion; the next action follows its first incomplete step. */
export default function SetupScreen() {
  const { t } = useTranslation();
  const progress = useApiQuery(() => api().getMyRegistrationProgress());

  return (
    <Screen edges={['bottom']} title={t('m.setup.title')} subtitle={t('m.setup.subtitle')} onRefresh={progress.reload}>
      <QueryView query={progress}>{(data) => {
        const completed = data.steps.filter((step) => step.done).length;
        return (
          <>
            <AppText step="body" accessibilityLiveRegion="polite">
              {t('m.setup.progress', { completed, total: data.steps.length })}
            </AppText>
            <SurfaceCard>
              {data.steps.map((step, index) => (
                <View key={step.name} style={[styles.step, index > 0 && styles.divider, step.name === data.nextStep && styles.current]}>
                  <AppText step="body" style={styles.stepName}>
                    {t(`m.setup.step_${step.name}`)}
                  </AppText>
                  <StatusTag tone={step.done ? 'verified' : 'pending'} label={t(step.done ? 'm.setup.complete' : 'm.setup.pending')} />
                </View>
              ))}
            </SurfaceCard>
            {data.nextStep ? (
              <Button
                label={t('m.setup.continueWith', { step: t(`m.setup.step_${data.nextStep}`) })}
                onPress={() => router.replace({ pathname: '/verify', params: { step: data.nextStep } })}
              />
            ) : (
              <>
                <AppText step="body" tone="secondary">{t('m.setup.allComplete')}</AppText>
                <Button label={t('m.setup.viewReview')} onPress={() => router.replace('/verify')} />
              </>
            )}
            <Button label={t('m.setup.surveyTitle')} variant="secondary" onPress={() => router.push('/setup/survey')} />
          </>
        );
      }}</QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  stepName: { flex: 1 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  current: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing[2] },
});
