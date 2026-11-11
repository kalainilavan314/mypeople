import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
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
  useApiAction,
  useMember,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { queuedScans, syncAllScans } from '@/features/scan/offlineQueue';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useStaff } from '@/providers/StaffProvider';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * S08 entry: the events of the coming week and checking a membership card.
 * Scans saved offline at any event can be sent from here once the phone is
 * back online, without returning to that event's scanner.
 * The API lists only events in the person's own areas: scanning needs
 * events.checkin_scan over the event's area (canScan), and an event manager
 * (events.manage) still opens the roster where they cannot scan.
 */
export default function CheckInScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const { permissions } = useStaff();
  const canScan = permissions.has('events.checkin_scan');
  const canSeeRoster = canScan || permissions.has('events.manage');
  const member = useMember();
  const [pending, setPending] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const refreshPending = useCallback(async () => {
    setPending((await queuedScans(null, member.id)).length);
  }, [member.id]);
  const sync = useApiAction(async () => {
    try {
      const outcomes = await syncAllScans(member.id);
      const count = (status: string) => outcomes.filter((outcome) => outcome.status === status).length;
      setSyncMessage(
        t('s.checkIn.syncResult', {
          accepted: count('ACCEPTED'),
          duplicate: count('DUPLICATE'),
          rejected: count('REJECTED'),
          waiting: count('NEEDS_REVIEW') + count('EXPIRED_QUEUE'),
        }),
      );
    } finally {
      await refreshPending();
    }
  });
  const events = useApiQuery(
    async () => canSeeRoster ? api().listCheckInEvents(new Date(Date.now() + WEEK_MS).toISOString()) : [],
    [canSeeRoster],
  );
  const reload = useCallback(() => {
    events.reload();
    void refreshPending();
  }, [events.reload, refreshPending]);
  useReloadOnFocus(reload);
  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  if (!canSeeRoster) {
    return <Screen edges={[]}><Notice tone="warning">{t('s.checkIn.noAccess')}</Notice></Screen>;
  }

  return (
    <Screen edges={[]} onRefresh={events.reload} refreshing={events.loading && events.data !== undefined}>
      {canScan && pending > 0 ? (
        <SurfaceCard>
          <AppText step="label">{t('s.checkIn.pending', { count: pending })}</AppText>
          <Button
            label={t('s.checkIn.syncQueued')}
            variant="secondary"
            icon="cloud-upload-outline"
            busy={sync.busy}
            busyLabel={t('s.checkIn.syncing')}
            onPress={() => void sync.run()}
          />
        </SurfaceCard>
      ) : null}
      {syncMessage ? <Notice tone="info">{syncMessage}</Notice> : null}
      {sync.error ? <Notice tone="error">{errorMessage(t, sync.error)}</Notice> : null}
      {canScan ? (
        <Button label={t('s.checkIn.cardCheck')} variant="secondary" icon="card-outline" onPress={() => router.push('/card-check')} />
      ) : null}
      <AppText step="section" accessibilityRole="header">
        {t('s.checkIn.chooseEvent')}
      </AppText>
      <QueryView query={events}>
        {(list) =>
          list.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('s.checkIn.noEvents')}
            </AppText>
          ) : (
            list.map((event) => (
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
                {event.canScan ? (
                  <Button
                    label={t('s.checkIn.scanPass')}
                    icon="qr-code-outline"
                    onPress={() => router.push({ pathname: '/checkin/[id]', params: { id: event.id } })}
                  />
                ) : null}
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
