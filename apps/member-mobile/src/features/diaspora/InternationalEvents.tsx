import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  DateBadge,
  formatDate,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

import { dateOnly, zoneCity } from './labels';

/**
 * FR-DSP-002: events listed for supporters abroad, each in Sri Lanka time and in the supporter's own
 * time zone, converted on the server from the zone they registered. Opens the event (E04) to RSVP.
 */
export function InternationalEvents({ registered }: { registered: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const events = useApiQuery(() => api().listDiasporaEvents(), [registered]);

  return (
    <View style={styles.section}>
      <AppText step="section" accessibilityRole="header">
        {t('m.diaspora.eventsTitle')}
      </AppText>
      <FeatureQueryView feature="diaspora" query={events}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.diaspora.noEvents')}
            </AppText>
          ) : (
            <View style={styles.list}>
              {!registered ? (
                <AppText step="secondary" tone="muted">
                  {t('m.diaspora.registerForLocal')}
                </AppText>
              ) : null}
              {items.map((event) => {
                const title = localized(event.titleEn, event.titleTa);
                const sriLanka = t('m.diaspora.sriLanka', {
                  date: formatDate(dateOnly(event.sriLanka.date), language),
                  time: event.sriLanka.time,
                });
                const local =
                  event.local && event.timeZone
                    ? t('m.diaspora.local', {
                        zone: zoneCity(event.timeZone),
                        date: formatDate(dateOnly(event.local.date), language),
                        time: event.local.time,
                      })
                    : null;
                return (
                  <SurfaceCard
                    key={event.id}
                    onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
                    accessibilityLabel={[title, local, sriLanka, event.venue].filter(Boolean).join('. ')}
                    accessibilityHint={t('m.diaspora.opensEvent')}>
                    <View style={styles.row}>
                      <DateBadge iso={event.startsAt} />
                      <View style={styles.text}>
                        <AppText step="card">{title}</AppText>
                        {local ? <AppText step="secondary">{local}</AppText> : null}
                        <AppText step="secondary" tone="secondary">
                          {sriLanka}
                        </AppText>
                        <AppText step="secondary" tone="muted">
                          {event.venue}
                        </AppText>
                      </View>
                    </View>
                  </SurfaceCard>
                );
              })}
            </View>
          )
        }
      </FeatureQueryView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  list: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
