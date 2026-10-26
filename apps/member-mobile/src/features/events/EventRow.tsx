import type { EventSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

import { AppText } from '@/components/AppText';
import { DateBadge } from '@/components/DateBadge';
import { StatusTag } from '@/components/StatusTag';
import { SurfaceCard } from '@/components/SurfaceCard';
import { useLanguage, useLocalized } from '@/hooks/useLanguage';
import { formatSpan } from '@/lib/format';

/** An event in a list: the whole card opens it (spec §6), with the member's own answer from the API. */
export function EventRow({ event }: { event: EventSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(event.titleEn, event.titleTa);
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      accessibilityLabel={title}>
      <View style={styles.row}>
        <DateBadge iso={event.startsAt} />
        <View style={styles.text}>
          <AppText step="card">{title}</AppText>
          <AppText step="secondary" tone="muted">
            {formatSpan(event.startsAt, event.endsAt, language)}
          </AppText>
          <AppText step="secondary" tone="muted" numberOfLines={1}>
            {event.venue}
          </AppText>
          <View style={styles.tags}>
            {event.state === 'cancelled' ? <StatusTag tone="error" label={t('m.events.cancelled')} /> : null}
            {event.myResponse === 'going' ? <StatusTag tone="verified" label={t('m.events.going')} /> : null}
            {event.myResponse === 'waitlisted' ? <StatusTag tone="pending" label={t('m.events.waitlisted')} /> : null}
            {event.myResponse === 'maybe' ? <StatusTag tone="neutral" label={t('m.events.maybe')} /> : null}
            {event.placesLeft === 0 && event.state !== 'cancelled' ? <StatusTag tone="neutral" label={t('m.events.full')} /> : null}
          </View>
        </View>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
});
