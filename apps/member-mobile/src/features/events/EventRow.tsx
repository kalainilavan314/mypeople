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
  let status: { tone: 'error' | 'pending' | 'verified' | 'neutral'; label: string } | null = null;
  if (event.state === 'cancelled') status = { tone: 'error', label: t('m.events.cancelled') };
  else if (event.myResponse === 'waitlisted') status = { tone: 'pending', label: t('m.events.waitlisted') };
  else if (event.myResponse === 'going') status = { tone: 'verified', label: t('m.events.going') };
  else if (event.myResponse === 'maybe') status = { tone: 'neutral', label: t('m.events.maybe') };
  else if (event.placesLeft === 0) status = { tone: 'neutral', label: t('m.events.full') };
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
          {status ? <StatusTag tone={status.tone} label={status.label} /> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  chevron: { alignSelf: 'center' },
});
