import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, MenuRow, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { OpportunityCard } from '@/features/volunteer/OpportunityCard';
import { api } from '@/lib/api';

/**
 * H11 Volunteer: open opportunities in the member's area, each with its date, time, role and
 * place; saved ones are marked. My skills (H10) and My assignments (H12) open from here.
 */
export default function VolunteerScreen() {
  const { t } = useTranslation();
  const opportunities = useApiQuery(() => api().listVolunteerOpportunities());
  useReloadOnFocus(opportunities.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={opportunities.reload}
      refreshing={opportunities.loading && opportunities.data !== undefined}>
      <FeatureQueryView feature="volunteer" query={opportunities}>
        {(items) => (
          <>
            <AppText step="body" tone="secondary">
              {t('m.volunteer.intro')}
            </AppText>
            <SurfaceCard style={styles.rowCard}>
              <MenuRow
                first
                icon="construct-outline"
                tint="rose"
                label={t('m.volunteer.mySkills')}
                hint={t('m.volunteer.mySkillsHint')}
                onPress={() => router.push('/volunteer/skills')}
              />
              <MenuRow
                icon="calendar-outline"
                tint="teal"
                label={t('m.volunteer.myAssignments')}
                hint={t('m.volunteer.myAssignmentsHint')}
                onPress={() => router.push('/volunteer/assignments')}
              />
            </SurfaceCard>
            <AppText step="section" accessibilityRole="header">
              {t('m.volunteer.openHeading')}
            </AppText>
            {items.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.volunteer.none')}
              </AppText>
            ) : (
              <View style={styles.list}>
                {items.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </View>
            )}
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowCard: { paddingVertical: 0 },
  list: { gap: spacing[3] },
});
