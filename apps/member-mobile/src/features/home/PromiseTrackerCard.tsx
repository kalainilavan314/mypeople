import type { HomeView } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, StatusTag, SurfaceCard } from '@my-people/mobile-ui';

import { STATUS_TONES } from '@/features/promises/labels';

import { FeatureTile } from './FeatureTile';

/**
 * M18 on Home: the Promise Tracker with the published promises made for the member's area, counted
 * by status in words and colour; it opens the tracker. While the tracker is switched off it shows
 * as not open yet, like every other service on Home.
 */
export function PromiseTrackerCard({ summary }: { summary: HomeView['promises'] }) {
  const { t } = useTranslation();
  if (!summary.feature.available) {
    return (
      <SurfaceCard style={styles.tile}>
        <FeatureTile feature={summary.feature} />
      </SurfaceCard>
    );
  }
  const counts = summary.counts.map((item) => ({
    status: item.status,
    label: t('m.home.promisesCount', { status: t(`m.promises.status_${item.status}`), count: item.count }),
  }));
  const intro = summary.total === 0 ? t('m.home.promisesNone') : t('m.home.promisesIntro');

  return (
    <SurfaceCard
      onPress={() => router.push('/promises')}
      accessibilityLabel={[t('m.home.feature_promises'), intro, ...counts.map((item) => item.label)].join('. ')}
      accessibilityHint={t('m.home.promisesOpen')}>
      <AppText step="secondary" tone="secondary">
        {intro}
      </AppText>
      {counts.length > 0 ? (
        <View style={styles.tags}>
          {counts.map((item) => (
            <StatusTag key={item.status} tone={STATUS_TONES[item.status]} label={item.label} />
          ))}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  tile: { padding: 0, gap: 0, overflow: 'hidden' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
