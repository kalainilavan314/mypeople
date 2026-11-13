import type { PromiseStatus, PromiseTheme } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  ChipRow,
  MenuRow,
  Screen,
  SurfaceCard,
  useApiQuery,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { useMyAreaKeys } from '@/features/area/useMyAreaKeys';
import { PROMISE_STATUSES, PROMISE_THEMES } from '@/features/promises/labels';
import { PromiseCard } from '@/features/promises/PromiseCard';
import { api } from '@/lib/api';

const ALL = 'all';

/**
 * M18 Promise Tracker: every published promise, open to everyone, filtered by status, theme and
 * the member's district, DS or GN division (FR-PRM-007). Withdrawn promises stay listed.
 */
export default function PromisesScreen() {
  const { t } = useTranslation();
  const areas = useMyAreaKeys();
  const [status, setStatus] = useState<PromiseStatus | typeof ALL>(ALL);
  const [theme, setTheme] = useState<PromiseTheme | typeof ALL>(ALL);
  const [area, setArea] = useState<string>(ALL);
  const promises = useApiQuery(
    () =>
      api().listPromises({
        status: status === ALL ? undefined : status,
        theme: theme === ALL ? undefined : theme,
        area: area === ALL ? undefined : area,
      }),
    [status, theme, area],
  );
  useReloadOnFocus(promises.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={promises.reload}
      refreshing={promises.loading && promises.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.promises.intro')}
      </AppText>
      <SurfaceCard style={styles.rowCard}>
        <MenuRow
          first
          icon="stats-chart-outline"
          tint="teal"
          label={t('m.scorecards.title')}
          hint={t('m.scorecards.linkHint')}
          onPress={() => router.push('/promises/scorecard')}
        />
        <MenuRow
          icon="mic-outline"
          tint="purple"
          label={t('m.townHalls.title')}
          hint={t('m.townHalls.linkHint')}
          onPress={() => router.push('/town-halls')}
        />
      </SurfaceCard>

      <View style={styles.filters}>
        <AppText step="label">{t('m.promises.filterStatus')}</AppText>
        <ChipRow
          label={t('m.promises.filterStatus')}
          selected={status}
          onSelect={setStatus}
          options={[
            { key: ALL, label: t('m.promises.all') },
            ...PROMISE_STATUSES.map((key) => ({ key, label: t(`m.promises.status_${key}`) })),
          ]}
        />
        <AppText step="label">{t('m.promises.filterTheme')}</AppText>
        <ChipRow
          label={t('m.promises.filterTheme')}
          selected={theme}
          onSelect={setTheme}
          options={[
            { key: ALL, label: t('m.promises.all') },
            ...PROMISE_THEMES.map((key) => ({ key, label: t(`m.promises.theme_${key}`) })),
          ]}
        />
        {areas.length > 0 ? (
          <>
            <AppText step="label">{t('m.promises.filterArea')}</AppText>
            <ChipRow
              label={t('m.promises.filterArea')}
              selected={area}
              onSelect={setArea}
              options={[
                { key: ALL, label: t('m.promises.everywhere') },
                ...areas.map((item) => ({ key: item.key, label: t(`m.promises.my_${item.level}`) })),
              ]}
            />
          </>
        ) : null}
      </View>

      <FeatureQueryView feature="promises" query={promises}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.promises.none')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {items.map((promise) => (
                <PromiseCard key={promise.id} promise={promise} />
              ))}
            </View>
          )
        }
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowCard: { paddingVertical: 0 },
  filters: { gap: spacing[2] },
  list: { gap: spacing[3] },
});
