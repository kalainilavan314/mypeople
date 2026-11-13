import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Screen, SurfaceCard, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ElectionDuties } from '@/features/volunteer/ElectionDuties';
import { EventDuties } from '@/features/volunteer/EventDuties';
import { OfferCard } from '@/features/volunteer/OfferCard';
import { api } from '@/lib/api';

/**
 * H12 My assignments: every offer and confirmed assignment with its role, time, meeting point,
 * status history and the coordinator's answers; election duties (M30); and the event duties an
 * organiser gave the member.
 */
export default function MyAssignmentsScreen() {
  const { t } = useTranslation();
  const offers = useApiQuery(() => api().listMyVolunteerOffers());
  const duties = useApiQuery(() => api().listMyVolunteerAssignments());
  const shifts = useApiQuery(() => api().listMyRosterShifts());
  const reload = useCallback(() => {
    offers.reload();
    duties.reload();
    shifts.reload();
  }, [offers.reload, duties.reload, shifts.reload]);
  useReloadOnFocus(reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={reload}
      refreshing={
        (offers.loading && offers.data !== undefined) ||
        (duties.loading && duties.data !== undefined) ||
        (shifts.loading && shifts.data !== undefined)
      }>
      <AppText step="body" tone="secondary">
        {t('m.volunteer.assignmentsIntro')}
      </AppText>
      <FeatureQueryView feature="volunteer" query={offers}>
        {(items) =>
          items.length === 0 ? (
            <SurfaceCard>
              <AppText step="secondary" tone="muted">
                {t('m.volunteer.noOffers')}
              </AppText>
              <Button label={t('m.volunteer.findOpportunities')} icon="search-outline" onPress={() => router.push('/volunteer')} />
            </SurfaceCard>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <OfferCard key={item.offer.id} item={item} reload={offers.reload} />
              ))}
            </View>
          )
        }
      </FeatureQueryView>
      <ElectionDuties query={shifts} />
      <EventDuties query={duties} />
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
