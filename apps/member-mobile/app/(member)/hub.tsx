import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, MenuRow, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { CommunityServiceTile } from '@/features/home/CommunityServiceTile';
import { MemberWelcomeCard } from '@/features/home/MemberWelcomeCard';
import { api } from '@/lib/api';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

/** H04: the community hub, a destination inside Home rather than a sixth tab (BRD §15A.4). */
export default function HubScreen() {
  const { t } = useTranslation();
  const home = useApiQuery(() => api().getHome());
  const { largeText } = useResponsiveLayout();
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
              <AppText step="section" accessibilityRole="header" style={[styles.sectionTitle, largeText && styles.responsiveSectionTitle]}>
                {t('m.home.hubServices')}
              </AppText>
              <View style={styles.serviceGrid}>
                {data.hub.services.map((feature) => (
                  <CommunityServiceTile key={feature.key} feature={feature} />
                ))}
              </View>
              {/* Town halls (M21) and statement reports (M48) have no Home key of their own. */}
              <AppText step="section" accessibilityRole="header" style={[styles.sectionTitle, largeText && styles.responsiveSectionTitle]}>
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
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  responsiveSectionTitle: { fontSize: 18, lineHeight: 27 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  rows: { paddingVertical: 0 },
});
