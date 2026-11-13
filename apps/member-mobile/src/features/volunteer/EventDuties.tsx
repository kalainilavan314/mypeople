import type { VolunteerAssignment } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  Notice,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useLanguage,
  useLocalized,
  type Loaded,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage, featureClosed } from '@/lib/errors';

import { EventPassLink } from './EventPassLink';
import { whenText } from './labels';

/**
 * Event duties an event organiser gave the member (registration, scanning and the rest), answered
 * here as on the Staff section's list. The duty and state words are the Staff section's.
 */
export function EventDuties({ query }: { query: Loaded<VolunteerAssignment[]> }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const respond = useApiAction(async (item: VolunteerAssignment, state: 'accepted' | 'declined') => {
    if (state === 'declined') {
      const yes = await confirmAction({
        title: t('m.volunteer.declineDutyTitle'),
        message: t('m.volunteer.declineDutyBody'),
        confirmLabel: t('s.assignments.decline'),
        cancelLabel: t('m.common.cancel'),
        destructive: true,
      });
      if (!yes) return;
    }
    await api().respondToVolunteerAssignment(item.id, {
      state,
      reason: state === 'accepted' ? 'Accepted by the assigned volunteer' : 'Declined by the assigned volunteer',
    });
    query.reload();
  });

  // Event duties belong to the events module; while it is off there is simply nothing to list.
  if (query.data === undefined && !query.loading && featureClosed(query.error)) return null;

  return (
    <QueryView query={query}>
      {(items) =>
        items.length === 0 ? null : (
          <View style={styles.list}>
            <AppText step="section" accessibilityRole="header">
              {t('m.volunteer.eventDuties')}
            </AppText>
            {respond.error ? <Notice tone="error">{errorMessage(t, respond.error)}</Notice> : null}
            {items.map((item) => (
              <SurfaceCard key={item.id} style={styles.card}>
                <AppText step="card">{localized(item.eventTitleEn, item.eventTitleTa)}</AppText>
                <AppText step="body" tone="secondary">
                  {t(`s.assignments.duty_${item.dutyType}`)}
                </AppText>
                <AppText step="secondary" tone="muted">
                  {whenText(item.shiftStart, item.shiftEnd, language)}
                </AppText>
                <StatusTag
                  tone={item.state === 'accepted' || item.state === 'completed' ? 'verified' : item.state === 'offered' ? 'pending' : 'neutral'}
                  label={t(`s.assignments.state_${item.state}`)}
                />
                <EventPassLink eventId={item.eventId} />
                {item.state === 'offered' ? (
                  <>
                    <Button label={t('s.assignments.accept')} busy={respond.busy} onPress={() => void respond.run(item, 'accepted')} />
                    <Button
                      label={t('s.assignments.decline')}
                      variant="secondary"
                      disabled={respond.busy}
                      onPress={() => void respond.run(item, 'declined')}
                    />
                  </>
                ) : null}
              </SurfaceCard>
            ))}
          </View>
        )
      }
    </QueryView>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
});
