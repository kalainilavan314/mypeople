import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { EventRow } from '@/features/events/EventRow';
import { FeatureTile } from '@/features/home/FeatureTile';
import { api } from '@/lib/api';

type NextStep = NonNullable<HomeView['nextStep']>;

function nextStepRoute(step: NextStep): Href {
  switch (step.kind) {
    case 'correct_identity':
    case 'submit_identity':
      return '/verify';
    case 'event_soon':
      return step.eventId ? { pathname: '/events/[id]', params: { id: step.eventId } } : '/events';
    case 'confirm_recovery_number':
      return { pathname: '/profile/recovery-number', params: { from: 'home' } };
    case 'complete_profile':
      return '/profile/edit';
  }
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
    <Screen maxContentWidth={720} onRefresh={reload} refreshing={home.loading && home.data !== undefined}>
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
  const showComingUp = next?.kind !== 'event_soon';
  const membershipTone = data.membershipState === 'active' ? 'verified' : data.membershipState === 'pending' ? 'pending' : 'error';

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText step="label" tone="primary">
            {t('m.welcome.title')}
          </AppText>
          <AppText step="page" accessibilityRole="header">
            {t('nav.home')}
          </AppText>
          <AppText step="body">{data.displayName}</AppText>
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

      <StatusTag
        tone={membershipTone}
        label={`${t('m.profile.membership')}: ${t(`m.home.membership_${data.membershipState}`)}`}
      />

      {data.layout === 'awaiting_review' && !next ? (
        <Notice tone="warning" title={t('m.home.awaitingTitle')}>
          <AppText step="secondary" tone="warning">
            {t('m.home.awaitingBody')}
          </AppText>
          <Button label={t('m.home.viewVerification')} variant="secondary" onPress={() => router.push('/verify')} />
        </Notice>
      ) : null}

      {next ? (
        <SurfaceCard accent style={styles.nextAction}>
          <AppText step="caption" tone="primary">
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
      <SurfaceCard style={styles.actionList}>
        {data.quickActions.map((feature, index) => (
          <FeatureTile key={feature.key} feature={feature} divided={index > 0} />
        ))}
      </SurfaceCard>

      {showComingUp ? (
        <>
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
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headerText: { flex: 1, gap: spacing[1] },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  bell: {
    width: control.touchMin,
    height: control.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.error },
  nextAction: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  actionList: { padding: 0, gap: 0, overflow: 'hidden' },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
