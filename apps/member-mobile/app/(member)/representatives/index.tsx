import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, MenuRow, Notice, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { RepresentativeCard } from '@/features/representatives/RepresentativeCard';
import { api } from '@/lib/api';

/**
 * M41 Meet your representative: the people responsible for each District, DS and GN division, with
 * their office hours and published appointment times. Those covering the member's own area come
 * first (FR-APT-001). Only contact routes the person approved are ever shown (FR-APT-007).
 */
export default function RepresentativesScreen() {
  const { t } = useTranslation();
  const representatives = useApiQuery(() => api().listRepresentatives());
  useReloadOnFocus(representatives.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={representatives.reload}
      refreshing={representatives.loading && representatives.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.representatives.intro')}
      </AppText>
      <SurfaceCard style={styles.rows}>
        <MenuRow
          first
          icon="calendar-outline"
          tint="teal"
          label={t('m.representatives.myAppointments')}
          hint={t('m.representatives.myAppointmentsHint')}
          onPress={() => router.push('/representatives/appointments')}
        />
      </SurfaceCard>

      <FeatureQueryView feature="representatives" query={representatives}>
        {(items) => {
          if (items.length === 0) {
            return (
              <AppText step="secondary" tone="muted">
                {t('m.representatives.none')}
              </AppText>
            );
          }
          const mine = items.filter((item) => item.coversMyArea);
          const others = items.filter((item) => !item.coversMyArea);
          return (
            <>
              <View style={styles.section}>
                <AppText step="section" accessibilityRole="header">
                  {t('m.representatives.forYourArea')}
                </AppText>
                {mine.length === 0 ? (
                  <Notice tone="info">{t('m.representatives.noneForArea')}</Notice>
                ) : (
                  mine.map((item) => <RepresentativeCard key={item.id} representative={item} />)
                )}
              </View>
              {others.length > 0 ? (
                <View style={styles.section}>
                  <AppText step="section" accessibilityRole="header">
                    {t('m.representatives.otherAreas')}
                  </AppText>
                  {others.map((item) => (
                    <RepresentativeCard key={item.id} representative={item} />
                  ))}
                </View>
              ) : null}
            </>
          );
        }}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { paddingVertical: 0 },
  section: { gap: spacing[3] },
});
