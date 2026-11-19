import type { HomeView } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  formatDateTime,
  IconTile,
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { PhotoBackdrop } from '@/components/PhotoBackdrop';
import { QueryView } from '@/components/QueryView';
import { EventRow } from '@/features/events/EventRow';
import { HomeActionTile } from '@/features/home/HomeActionTile';
import { MemberWelcomeCard } from '@/features/home/MemberWelcomeCard';
import { PromiseTrackerCard } from '@/features/home/PromiseTrackerCard';
import { StaffRoleTags } from '@/features/staff/StaffRoleTags';
import { useMyStaffRoles } from '@/features/staff/useMyStaffRoles';
import { api } from '@/lib/api';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

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
    <Screen
      edges={[]}
      maxContentWidth={720}
      backdrop={<PhotoBackdrop />}
      onRefresh={reload}
      refreshing={home.loading && home.data !== undefined}>
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
  const roles = useMyStaffRoles();
  const staff = roles.assignments.length > 0;
  const { largeText } = useResponsiveLayout();

  return (
    <>
      <MemberWelcomeCard place={place} membershipState={data.membershipState} />

      {data.safetyAlerts > 0 ? (
        <Notice tone="warning" title={t('m.home.safetyBannerTitle', { count: data.safetyAlerts })}>
          <AppText step="secondary" tone="warning">
            {t('m.home.safetyBannerBody')}
          </AppText>
          <Button label={t('m.home.safetyBannerOpen')} variant="secondary" icon="warning-outline" onPress={() => router.push('/alerts')} />
        </Notice>
      ) : null}

      {data.layout === 'awaiting_review' && !next ? (
        <Notice tone="warning" title={t('m.home.awaitingTitle')}>
          <AppText step="secondary" tone="warning">
            {t('m.home.awaitingBody')}
          </AppText>
          <Button label={t('m.home.viewVerification')} variant="secondary" onPress={() => router.push('/verify')} />
        </Notice>
      ) : null}

      {next ? (
        <SurfaceCard accent variant="glass" style={styles.nextAction}>
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

      {/* Only for people with a staff role: their tier, and the way into the Staff section, which
          asks for the authenticator code (OD-26, one app for members and staff). */}
      {staff ? (
        <SurfaceCard variant="glass" onPress={() => router.push('/staff')} accessibilityLabel={t('m.home.staffSection')}>
          <AppText step="section">{t('m.home.staffSection')}</AppText>
          <View style={styles.tags}>
            <StaffRoleTags roles={roles} />
          </View>
          <AppText step="secondary" tone="secondary">
            {t('m.home.staffSectionBody')}
          </AppText>
        </SurfaceCard>
      ) : null}

      <AppText step="section" accessibilityRole="header" style={[styles.sectionTitle, largeText && styles.responsiveSectionTitle]}>
        {t('m.home.quickActions')}
      </AppText>
      <View style={styles.actionGrid}>
        {data.quickActions.map((feature) => (
          <HomeActionTile key={feature.key} feature={feature} />
        ))}
      </View>

      {showComingUp ? (
        <>
          <View style={styles.sectionRow}>
            <AppText
              step="section"
              accessibilityRole="header"
              style={[styles.flex, styles.sectionTitle, largeText && styles.responsiveSectionTitle]}>
              {t('m.home.comingUp')}
            </AppText>
            <Button label={t('m.common.seeAll')} variant="quiet" onPress={() => router.push('/events')} />
          </View>
          {data.comingUp ? (
            <EventRow event={data.comingUp} />
          ) : (
            <SurfaceCard variant="glass" style={styles.emptyEvents}>
              <View style={styles.emptyEventCopy}>
                <IconTile icon="calendar-outline" tint="brand" />
                <AppText step="body" tone="secondary" style={styles.flex}>
                  {t('m.home.noEvents')}
                </AppText>
              </View>
              <Button label={t('m.home.browseEvents')} variant="secondary" onPress={() => router.push('/events')} />
            </SurfaceCard>
          )}
        </>
      ) : null}

      {/* M18: the Promise Tracker is on Home as well as in the Community Hub. An API from before
          this addition sends no summary, so the section is left out rather than failing. */}
      {data.promises ? (
        <>
          <View style={styles.sectionRow}>
            <AppText
              step="section"
              accessibilityRole="header"
              style={[styles.flex, styles.sectionTitle, largeText && styles.responsiveSectionTitle]}>
              {t('m.home.feature_promises')}
            </AppText>
            {data.promises.feature.available ? (
              <Button label={t('m.common.seeAll')} variant="quiet" onPress={() => router.push('/promises')} />
            ) : null}
          </View>
          <PromiseTrackerCard summary={data.promises} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  nextAction: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  responsiveSectionTitle: { fontSize: 18, lineHeight: 27 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  emptyEvents: { gap: spacing[4] },
  emptyEventCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
