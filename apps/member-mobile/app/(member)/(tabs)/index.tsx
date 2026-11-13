import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { EventRow } from '@/features/events/EventRow';
import { HomeActionTile } from '@/features/home/HomeActionTile';
import { MemberWelcomeCard } from '@/features/home/MemberWelcomeCard';
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

  const reload = useCallback(() => {
    home.reload();
  }, [home.reload]);
  useReloadOnFocus(reload);

  return (
    <Screen edges={[]} maxContentWidth={720} onRefresh={reload} refreshing={home.loading && home.data !== undefined}>
      <QueryView query={home}>{(data) => <HomeBody data={data} />}</QueryView>
    </Screen>
  );
}

function HomeBody({ data }: { data: HomeView }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const place = [data.districtName, data.gnName].filter(Boolean).join(' / ');
  const next = data.nextStep;
  const showComingUp = next?.kind !== 'event_soon';

  return (
    <>
      <MemberWelcomeCard place={place} membershipState={data.membershipState} />

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

      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.home.quickActions')}
      </AppText>
      <View style={styles.actionGrid}>
        {data.quickActions.map((feature, index) => (
          <HomeActionTile key={feature.key} feature={feature} tone={index === 0 || index === 3 ? 'red' : 'yellow'} />
        ))}
      </View>

      {showComingUp ? (
        <>
          <View style={styles.sectionRow}>
            <AppText step="section" accessibilityRole="header" style={[styles.flex, styles.sectionTitle]}>
              {t('m.home.comingUp')}
            </AppText>
            <Button label={t('m.common.seeAll')} variant="quiet" onPress={() => router.push('/events')} />
          </View>
          {data.comingUp ? (
            <EventRow event={data.comingUp} />
          ) : (
            <SurfaceCard style={styles.emptyEvents}>
              <View style={styles.emptyEventCopy}>
                <Ionicons name="calendar-outline" size={34} color={colors.primary} />
                <AppText step="body" tone="secondary" style={styles.flex}>
                  {t('m.home.noEvents')}
                </AppText>
              </View>
              <Button label={t('m.home.browseEvents')} variant="secondary" onPress={() => router.push('/events')} />
            </SurfaceCard>
          )}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  nextAction: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  sectionTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  emptyEvents: { gap: spacing[4] },
  emptyEventCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
