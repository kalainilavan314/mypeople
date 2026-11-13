import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';
import { AppText, Button, Notice, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** A18: the API owns completion; the next action follows its first incomplete step. */
export default function SetupScreen() {
  const { t } = useTranslation();
  const progress = useApiQuery(() => api().getMyRegistrationProgress());

  return (
    <Screen edges={['bottom']} maxContentWidth={640} title={t('m.setup.title')} subtitle={t('m.setup.subtitle')} onRefresh={progress.reload}>
      <QueryView query={progress}>{(data) => {
        const completed = data.steps.filter((step) => step.done).length;
        const percent = data.steps.length > 0 ? Math.round((completed / data.steps.length) * 100) : 0;
        return (
          <>
            <AppText step="body" accessibilityLiveRegion="polite">
              {t('m.setup.progress', { completed, total: data.steps.length })}
            </AppText>
            <View
              style={styles.progressTrack}
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            {data.nextStep ? (
              <SurfaceCard accent style={styles.nextAction}>
                <AppText step="caption" tone="primary">{t('m.setup.nextStep')}</AppText>
                <AppText step="section">{t(`m.setup.step_${data.nextStep}`)}</AppText>
                <Button
                  label={t('m.setup.continueWith', { step: t(`m.setup.step_${data.nextStep}`) })}
                  onPress={() => router.replace({ pathname: '/verify', params: { step: data.nextStep } })}
                />
              </SurfaceCard>
            ) : (
              <>
                <Notice tone="success">{t('m.setup.allComplete')}</Notice>
                <Button label={t('m.setup.viewReview')} onPress={() => router.replace('/verify')} />
              </>
            )}
            <AppText step="section" accessibilityRole="header">{t('m.setup.stepsTitle')}</AppText>
            <SurfaceCard style={styles.stepsCard}>
              {data.steps.map((step, index) => {
                const current = step.name === data.nextStep;
                const icon = step.done ? 'checkmark-circle' : current ? 'arrow-forward-circle' : 'ellipse-outline';
                const iconColor = step.done ? colors.successText : current ? colors.primary : colors.textMuted;
                const tone = step.done ? 'success' : current ? 'primary' : 'muted';
                return (
                  <View key={step.name} style={[styles.step, index > 0 && styles.divider, current && styles.current]}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                    <AppText step="body" style={styles.stepName}>
                      {t(`m.setup.step_${step.name}`)}
                    </AppText>
                    <AppText step="caption" tone={tone}>
                      {t(step.done ? 'm.setup.complete' : 'm.setup.pending')}
                    </AppText>
                  </View>
                );
              })}
            </SurfaceCard>
            <Button label={t('m.setup.surveyTitle')} variant="secondary" onPress={() => router.push('/setup/survey')} />
          </>
        );
      }}</QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceVariant },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  nextAction: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  stepsCard: { padding: 0, gap: 0, overflow: 'hidden' },
  step: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  stepName: { flex: 1 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  current: { backgroundColor: colors.primaryContainer },
});
