import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import { AppText, Screen, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { CommunityServiceTile } from '@/features/home/CommunityServiceTile';
import { MemberWelcomeCard } from '@/features/home/MemberWelcomeCard';
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
        {(data) => {
          const place = data.hub.gnLabel ?? [data.districtName, data.gnName].filter(Boolean).join(' / ');
          return (
            <>
              <MemberWelcomeCard place={place} membershipState={data.membershipState} />
              <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
              {t('m.home.hubServices')}
              </AppText>
              <View style={styles.serviceGrid}>
              {data.hub.services.map((feature) => (
                <CommunityServiceTile key={feature.key} feature={feature} />
              ))}
              </View>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
