import type { VolunteerContact, VolunteerOfferItem } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, formatDateTime, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';

import { ContactCoordinator } from './ContactCoordinator';
import { EventPassLink } from './EventPassLink';
import { whenText } from './labels';
import { OfferStatusTag } from './OfferStatusTag';

/**
 * One offer or confirmed assignment in H12: the role, time and meeting point the coordinator set,
 * every change of status, and the messages with their answers. Coordinators are never named and
 * no phone number is shown (FR-VOL-007).
 */
export function OfferCard({ item, reload }: { item: VolunteerOfferItem; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const { offer, opportunity } = item;
  const role = offer.roleEn ? localized(offer.roleEn, offer.roleTa ?? '') : localized(opportunity.roleEn, opportunity.roleTa);
  const meetingPoint = offer.meetingPointEn ? localized(offer.meetingPointEn, offer.meetingPointTa ?? '') : null;
  const active = offer.state === 'offered' || offer.state === 'confirmed';
  const eventId = opportunity.eventId;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{localized(opportunity.titleEn, opportunity.titleTa)}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {offer.offerRef}
      </AppText>
      <OfferStatusTag state={offer.state} />
      <DetailRow label={t('m.volunteer.role')} value={role} />
      <DetailRow label={t('m.volunteer.when')} value={whenText(opportunity.startsAt, opportunity.endsAt, language)} />
      {meetingPoint ? (
        <DetailRow label={t('m.volunteer.meetingPoint')} value={meetingPoint} />
      ) : (
        <DetailRow label={t('m.volunteer.where')} value={localized(opportunity.placeEn, opportunity.placeTa)} />
      )}
      {offer.decisionReason ? <DetailRow label={t('m.volunteer.reason')} value={offer.decisionReason} /> : null}
      {eventId && active ? <EventPassLink eventId={eventId} /> : null}
      {eventId && !active ? (
        <Button
          label={t('m.volunteer.viewEvent')}
          variant="secondary"
          icon="calendar-outline"
          onPress={() => router.push({ pathname: '/events/[id]', params: { id: eventId } })}
        />
      ) : null}

      {item.history.length > 0 ? (
        <View style={styles.section}>
          <AppText step="label">{t('m.volunteer.history')}</AppText>
          {item.history.map((entry) => (
            <View key={`${entry.toState}-${entry.occurredAt}`} style={styles.entry}>
              <AppText step="secondary">
                {t(`m.profile.activityState_volunteer_offer_${entry.toState}`, { defaultValue: entry.toState })}
              </AppText>
              <AppText step="caption" tone="muted">
                {formatDateTime(entry.occurredAt, language)}
              </AppText>
              {entry.reason ? (
                <AppText step="secondary" tone="secondary">
                  {entry.reason}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {item.contacts.length > 0 ? (
        <View style={styles.section}>
          <AppText step="label">{t('m.volunteer.messages')}</AppText>
          {item.contacts.map((contact) => (
            <ContactEntry key={contact.id} contact={contact} />
          ))}
        </View>
      ) : null}

      {active ? <ContactCoordinator offerId={offer.id} confirmed={offer.state === 'confirmed'} onSent={reload} /> : null}
    </SurfaceCard>
  );
}

function ContactEntry({ contact }: { contact: VolunteerContact }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <View style={styles.entry}>
      <AppText step="caption" tone="primary">
        {contact.kind === 'change_request' ? t('m.volunteer.yourChangeRequest') : t('m.volunteer.yourMessage')}
      </AppText>
      <AppText step="secondary">{contact.body}</AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(contact.createdAt, language)}
      </AppText>
      {contact.answer ? (
        <View style={styles.answer}>
          <AppText step="caption" tone="primary">
            {t('m.volunteer.coordinatorAnswer')}
          </AppText>
          <AppText step="secondary">{contact.answer}</AppText>
          {contact.answeredAt ? (
            <AppText step="caption" tone="muted">
              {formatDateTime(contact.answeredAt, language)}
            </AppText>
          ) : null}
        </View>
      ) : (
        <StatusTag tone="pending" label={t('m.volunteer.awaitingAnswer')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  section: { gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
  entry: { gap: 2 },
  answer: { gap: 2, marginTop: spacing[1], paddingLeft: spacing[3], borderLeftWidth: 3, borderLeftColor: colors.border },
});
