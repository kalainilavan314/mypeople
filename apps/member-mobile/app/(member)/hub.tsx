import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, MenuRow, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { FeatureTile } from '@/features/home/FeatureTile';
import { api } from '@/lib/api';

/** H04: the community hub, a destination inside Home rather than a sixth tab (BRD §15A.4). */
export default function HubScreen() {
  const { t } = useTranslation();
  const home = useApiQuery(() => api().getHome());
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={home.reload}
      refreshing={home.loading && home.data !== undefined}>
      <QueryView query={home}>
        {(data) => (
          <>
            {data.hub.gnLabel ? (
              <AppText step="body" tone="secondary">
                {data.hub.gnLabel}
              </AppText>
            ) : null}
            <AppText step="section" accessibilityRole="header">
              {t('m.home.hubServices')}
            </AppText>
            <SurfaceCard style={styles.serviceList}>
              {data.hub.services.map((feature, index) => (
                <FeatureTile key={feature.key} feature={feature} divided={index > 0} />
              ))}
            </SurfaceCard>
            {/* Town halls (M21) and statement reports (M48) have no Home key of their own. */}
            <AppText step="section" accessibilityRole="header">
              {t('m.home.hubMore')}
            </AppText>
            <SurfaceCard style={styles.rows}>
              <MenuRow
                first
                icon="mic-outline"
                tint="purple"
                label={t('m.townHalls.askTheLeader')}
                hint={t('m.townHalls.linkHint')}
                onPress={() => router.push('/town-halls')}
              />
              <MenuRow
                icon="shield-checkmark-outline"
                tint="blue"
                label={t('m.official.title')}
                hint={t('m.official.hubHint')}
                onPress={() => router.push('/official')}
              />
            </SurfaceCard>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  serviceList: { padding: 0, gap: 0, overflow: 'hidden' },
  rows: { paddingVertical: 0 },
});
