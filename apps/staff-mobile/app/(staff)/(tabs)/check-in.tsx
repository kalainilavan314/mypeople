import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import {
  AppText,
  Button,
  DateBadge,
  formatSpan,
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * S08 entry: the events of the coming week and checking a membership card.
 * Scanning at an event needs events.checkin_scan over its area; the API
 * checks that per event, so an event outside the person's areas refuses.
 */
export default function CheckInScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const { permissions } = useStaff();
  const canScan = permissions.has('events.checkin_scan');
  const events = useApiQuery(
    async () => canScan ? api().listEvents({ scope: 'all', until: new Date(Date.now() + WEEK_MS).toISOString() }) : [],
    [canScan],
  );
  useReloadOnFocus(events.reload);

  if (!canScan) {
    return <Screen edges={[]}><Notice tone="warning">{t('s.checkIn.noAccess')}</Notice></Screen>;
  }

  return (
    <Screen edges={[]} onRefresh={events.reload} refreshing={events.loading && events.data !== undefined}>
      <Button label={t('s.checkIn.cardCheck')} variant="secondary" icon="card-outline" onPress={() => router.push('/card-check')} />
      <AppText step="section" accessibilityRole="header">
        {t('s.checkIn.chooseEvent')}
      </AppText>
      <QueryView query={events}>
        {(list) =>
          list.filter((event) => event.state === 'published').length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('s.checkIn.noEvents')}
            </AppText>
          ) : (
            list
              .filter((event) => event.state === 'published')
              .map((event) => (
                <SurfaceCard key={event.id}>
                  <View style={styles.row}>
                    <DateBadge iso={event.startsAt} />
                    <View style={styles.text}>
                      <AppText step="card">{localized(event.titleEn, event.titleTa)}</AppText>
                      <AppText step="secondary" tone="muted">
                        {`${formatSpan(event.startsAt, event.endsAt, language)} · ${event.venue}`}
                      </AppText>
                      <AppText step="caption" tone="muted" mono>
                        {event.eventRef}
                      </AppText>
                    </View>
                  </View>
                  <Button
                    label={t('s.checkIn.scanPass')}
                    icon="qr-code-outline"
                    onPress={() => router.push({ pathname: '/checkin/[id]', params: { id: event.id } })}
                  />
                  <Button
                    label={t('s.checkIn.roster')}
                    variant="secondary"
                    icon="people-outline"
                    onPress={() => router.push({ pathname: '/roster/[id]', params: { id: event.id } })}
                  />
                </SurfaceCard>
              ))
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
});
