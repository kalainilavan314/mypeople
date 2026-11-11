import type { EventSummary } from '@my-people/api-client';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  DateBadge,
  formatSpan,
  StatusTag,
  SurfaceCard,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

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
          <AppText step="card" weight={400}>{title}</AppText>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <AppText step="secondary" tone="muted" style={styles.flex}>
              {formatSpan(event.startsAt, event.endsAt, language)}
            </AppText>
          </View>
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <AppText step="secondary" tone="muted" numberOfLines={1} style={styles.flex}>
              {event.venue}
            </AppText>
          </View>
          <View style={styles.tags}>
            {event.state === 'cancelled' ? <StatusTag tone="error" label={t('m.events.cancelled')} /> : null}
            {event.myResponse === 'going' ? <StatusTag tone="verified" label={t('m.events.going')} /> : null}
            {event.myResponse === 'waitlisted' ? <StatusTag tone="pending" label={t('m.events.waitlisted')} /> : null}
            {event.myResponse === 'maybe' ? <StatusTag tone="neutral" label={t('m.events.maybe')} /> : null}
            {event.placesLeft === 0 && event.state !== 'cancelled' ? <StatusTag tone="neutral" label={t('m.events.full')} /> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.controlBorder} style={styles.chevron} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  chevron: { alignSelf: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
});
