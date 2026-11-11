import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';

import { AppText, Screen, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { FeatureTile } from '@/features/home/FeatureTile';
import { api } from '@/lib/api';

/** H04: the community hub, a destination inside Home rather than a sixth tab (BRD §15A.4). */
export default function HubScreen() {
  const { t } = useTranslation();
  const home = useApiQuery(() => api().getHome());
  return (
    <Screen edges={['bottom']} onRefresh={home.reload} refreshing={home.loading && home.data !== undefined}>
      <QueryView query={home}>
        {(data) => (
          <>
            {data.hub.gnLabel ? (
              <AppText step="secondary" tone="muted">
                {data.hub.gnLabel}
              </AppText>
            ) : null}
            <View style={styles.grid}>
              {data.hub.services.map((feature) => (
                <FeatureTile key={feature.key} feature={feature} />
              ))}
            </View>
            <AppText step="caption" tone="muted">
              {t('m.common.notBuiltDetail')}
            </AppText>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] } });
