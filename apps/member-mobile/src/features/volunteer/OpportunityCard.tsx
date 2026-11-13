import type { VolunteerOpportunity } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, IconTile, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { whenText } from './labels';
import { OfferStatusTag } from './OfferStatusTag';

/** One open opportunity in H11: what, when, the role and the place; opens the briefing. */
export function OpportunityCard({ opportunity }: { opportunity: VolunteerOpportunity }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(opportunity.titleEn, opportunity.titleTa);
  const role = localized(opportunity.roleEn, opportunity.roleTa);
  const place = localized(opportunity.placeEn, opportunity.placeTa);
  const when = whenText(opportunity.startsAt, opportunity.endsAt, language);
  const saved = opportunity.saved ? `. ${t('m.volunteer.saved')}` : '';
  const offer = opportunity.myOffer
    ? `. ${t(`m.profile.activityState_volunteer_offer_${opportunity.myOffer.state}`)}`
    : '';

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/volunteer/[id]', params: { id: opportunity.id } })}
      accessibilityLabel={`${title}. ${role}. ${when}. ${place}${saved}${offer}`}
      accessibilityHint={t('m.volunteer.opensBriefing')}>
      <View style={styles.row}>
        <IconTile icon="hand-left-outline" tint="rose" size={40} />
        <View style={styles.text}>
          <AppText step="card">{title}</AppText>
          <AppText step="secondary" tone="secondary">
            {role}
          </AppText>
        </View>
      </View>
      <AppText step="secondary" tone="secondary">
        {when}
      </AppText>
      <AppText step="secondary" tone="muted">
        {place}
      </AppText>
      {opportunity.saved || opportunity.myOffer ? (
        <View style={styles.tags}>
          {opportunity.saved ? <StatusTag tone="neutral" label={t('m.volunteer.saved')} /> : null}
          {opportunity.myOffer ? <OfferStatusTag state={opportunity.myOffer.state} /> : null}
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
