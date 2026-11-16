import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Notice, Screen, useApiQuery, useLocalized, useReloadOnFocus } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { OfferDecisionCard } from '@/features/staff/volunteers/OfferDecisionCard';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

/** S10 one opportunity's offers: those waiting first, each confirmed with a meeting point or declined with a reason. */
export default function StaffOpportunityOffersScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { permissions } = useStaff();
  const { id } = useLocalSearchParams<{ id: string }>();
  const offers = useApiQuery(() => api().listVolunteerOffers(id), [id]);
  const opportunities = useApiQuery(() => api().listManagedVolunteerOpportunities());
  // Skill names for the volunteers' keys; the keys show if the list cannot be read.
  const skills = useApiQuery(() => api().getVolunteerSkills());
  const reload = useCallback(() => {
    offers.reload();
    opportunities.reload();
  }, [offers.reload, opportunities.reload]);
  useReloadOnFocus(reload);

  if (!permissions.has('volunteers.manage')) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.volunteers.noAccess')}</Notice>
      </Screen>
    );
  }

  const opportunity = opportunities.data?.find((item) => item.id === id);
  const skillName = (key: string) => {
    const found = skills.data?.skills.find((skill) => skill.key === key);
    return found ? localized(found.nameEn, found.nameTa) : key;
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={reload} refreshing={offers.loading && offers.data !== undefined}>
      {opportunity ? (
        <View style={styles.header}>
          <AppText step="page" accessibilityRole="header">
            {localized(opportunity.titleEn, opportunity.titleTa)}
          </AppText>
          <AppText step="secondary" tone="secondary">
            {t('s.volunteers.places', { confirmed: opportunity.confirmed, places: opportunity.places })}
          </AppText>
        </View>
      ) : null}
      <AppText step="secondary" tone="muted">
        {t('s.volunteers.privacy')}
      </AppText>
      <QueryView query={offers}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('s.volunteers.noOffers')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {[...items]
                .sort((a, b) => Number(b.state === 'offered') - Number(a.state === 'offered'))
                .map((offer) => (
                  <OfferDecisionCard key={offer.id} offer={offer} skillName={skillName} onDecided={reload} />
                ))}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
  list: { gap: spacing[3] },
});
