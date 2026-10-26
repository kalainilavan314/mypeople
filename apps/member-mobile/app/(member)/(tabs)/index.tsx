import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { SurfaceCard } from '@/components/SurfaceCard';
import { EventRow } from '@/features/events/EventRow';
import { FeatureTile } from '@/features/home/FeatureTile';
import { useApiQuery } from '@/hooks/useApi';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useLanguage, useLocalized } from '@/hooks/useLanguage';
import { api } from '@/lib/api';
import { formatDateTime, localHour } from '@/lib/format';

type NextStep = NonNullable<HomeView['nextStep']>;

function nextStepRoute(step: NextStep): Href {
  switch (step.kind) {
    case 'correct_identity':
    case 'submit_identity':
      return '/verify';
    case 'event_soon':
      return step.eventId ? { pathname: '/events/[id]', params: { id: step.eventId } } : '/events';
    case 'confirm_recovery_number':
      return '/profile/recovery-number';
    case 'complete_profile':
      return '/profile/edit';
  }
}

function greetingKey(): string {
  const hour = localHour();
  return hour < 12 ? 'm.home.greetingMorning' : hour < 17 ? 'm.home.greetingAfternoon' : 'm.home.greetingEvening';
}

/** H01 for Verified and Active members, H02 while identity or membership is pending; the server decides which. */
export default function HomeScreen() {
  const home = useApiQuery(() => api().getHome());
  const inbox = useApiQuery(() => api().getNotifications({ limit: 1 }));

  const reload = useCallback(() => {
    home.reload();
    inbox.reload();
  }, [home.reload, inbox.reload]);
  useReloadOnFocus(reload);

  return (
    <Screen onRefresh={reload} refreshing={home.loading && home.data !== undefined}>
      <QueryView query={home}>{(data) => <HomeBody data={data} unread={inbox.data?.unread ?? 0} />}</QueryView>
    </Screen>
  );
}

function HomeBody({ data, unread }: { data: HomeView; unread: number }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const place = [data.districtName, data.gnName].filter(Boolean).join(' / ');
  const next = data.nextStep;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText step="page" accessibilityRole="header">
            {`${t(greetingKey())}, ${data.displayName}`}
          </AppText>
          {place ? (
            <View style={styles.place}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <AppText step="secondary" tone="muted">
                {place}
              </AppText>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${t('m.home.notifications')}, ${t('m.home.unread', { count: unread })}` : t('m.home.notifications')}
          style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      {data.layout === 'awaiting_review' ? (
        <Notice tone="warning" title={t('m.home.awaitingTitle')}>
          <AppText step="secondary" tone="warning">
            {t('m.home.awaitingBody')}
          </AppText>
          <Button label={t('m.home.viewVerification')} variant="secondary" onPress={() => router.push('/verify')} />
        </Notice>
      ) : null}

      {next ? (
        <SurfaceCard accent>
          <AppText step="caption" tone="muted">
            {t('m.home.nextStep')}
          </AppText>
          <AppText step="section">{t(`m.home.next_${next.kind}`)}</AppText>
          {next.kind === 'event_soon' && next.eventTitleEn ? (
            <AppText step="secondary" tone="secondary">
              {localized(next.eventTitleEn, next.eventTitleTa ?? '')}
              {next.startsAt ? ` · ${formatDateTime(next.startsAt, language)}` : ''}
            </AppText>
          ) : null}
          {next.reviewRef ? (
            <AppText step="secondary" tone="muted" mono>
              {next.reviewRef}
            </AppText>
          ) : null}
          <Button label={t('m.home.openStep')} onPress={() => router.push(nextStepRoute(next))} />
        </SurfaceCard>
      ) : null}

      <AppText step="section" accessibilityRole="header">
        {t('m.home.quickActions')}
      </AppText>
      <View style={styles.grid}>
        {data.quickActions.map((feature) => (
          <FeatureTile key={feature.key} feature={feature} />
        ))}
      </View>

      <View style={styles.sectionRow}>
        <AppText step="section" accessibilityRole="header" style={styles.flex}>
          {t('m.home.comingUp')}
        </AppText>
        <Button label={t('m.common.seeAll')} variant="quiet" onPress={() => router.push('/events')} />
      </View>
      {data.comingUp ? (
        <EventRow event={data.comingUp} />
      ) : (
        <SurfaceCard>
          <AppText step="secondary" tone="muted">
            {t('m.home.noEvents')}
          </AppText>
          <Button label={t('m.home.browseEvents')} variant="secondary" onPress={() => router.push('/events')} />
        </SurfaceCard>
      )}

      <Button label={t('m.home.hub')} variant="secondary" icon="people-outline" onPress={() => router.push('/hub')} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headerText: { flex: 1, gap: spacing[2] },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  bell: {
    width: control.touchMin,
    height: control.touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  dot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.error },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
