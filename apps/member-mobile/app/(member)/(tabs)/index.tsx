import Ionicons from '@expo/vector-icons/Ionicons';
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
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { SectionHeader } from '@/components/SectionHeader';
import { EventRow } from '@/features/events/EventRow';
import { FeatureRow } from '@/features/home/FeatureRow';
import { MemberWelcomeCard } from '@/features/home/MemberWelcomeCard';
import { PromiseTrackerCard } from '@/features/home/PromiseTrackerCard';
import { StaffRoleTags } from '@/features/staff/StaffRoleTags';
import { useMyStaffRoles } from '@/features/staff/useMyStaffRoles';
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
  const roles = useMyStaffRoles();
  const staff = roles.assignments.length > 0;

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
          <AppText step="caption" tone="secondary">
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
        <SurfaceCard onPress={() => router.push('/staff')} accessibilityLabel={t('m.home.staffSection')}>
          <View style={styles.titleRow}>
            <AppText step="card" style={styles.flex}>{t('m.home.staffSection')}</AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.controlBorder} accessibilityElementsHidden importantForAccessibility="no" />
          </View>
          <View style={styles.tags}>
            <StaffRoleTags roles={roles} />
          </View>
          <AppText step="secondary" tone="secondary">
            {t('m.home.staffSectionBody')}
          </AppText>
        </SurfaceCard>
      ) : null}

      <SectionHeader title={t('m.home.quickActions')} />
      <SurfaceCard style={styles.list}>
        {data.quickActions.map((feature, index) => (
          <FeatureRow key={feature.key} feature={feature} first={index === 0} />
        ))}
      </SurfaceCard>

      {showComingUp ? (
        <>
          <SectionHeader title={t('m.home.comingUp')} actionLabel={t('m.common.seeAll')} onAction={() => router.push('/events')} />
          {data.comingUp ? (
            <EventRow event={data.comingUp} />
          ) : (
            <SurfaceCard style={styles.emptyEvents}>
              <View style={styles.emptyEventCopy}>
                <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
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
          <SectionHeader
            title={t('m.home.feature_promises')}
            actionLabel={data.promises.feature.available ? t('m.common.seeAll') : undefined}
            onAction={() => router.push('/promises')}
          />
          <PromiseTrackerCard summary={data.promises} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  nextAction: { gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  emptyEvents: { gap: spacing[4] },
  emptyEventCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
