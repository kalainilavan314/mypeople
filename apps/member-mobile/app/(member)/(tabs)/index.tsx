import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  formatDateTime,
  LanguageToggle,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useMember,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { EventRow } from '@/features/events/EventRow';
import { FeatureTile } from '@/features/home/FeatureTile';
import { MemberCardPreview } from '@/features/home/MemberCardPreview';
import { StatusNotice } from '@/features/home/StatusNotice';
import { api } from '@/lib/api';
import { chooseLanguage } from '@/lib/i18n';

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

/** The amber card while identity or membership is pending: what is happening and where to look. */
function pendingNotice(data: HomeView): { title: string; body: string } {
  switch (data.identityState) {
    case 'not_submitted':
      return { title: 'm.home.startTitle', body: 'm.home.startBody' };
    case 'needs_update':
      return { title: 'm.home.updateTitle', body: 'm.home.updateBody' };
    case 'verified':
      return { title: 'm.home.membership_pending', body: 'm.home.awaitingBody' };
    default:
      return { title: 'm.home.reviewTitle', body: 'm.home.reviewBody' };
  }
}

function HomeBody({ data, unread }: { data: HomeView; unread: number }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const member = useMember();
  const place = [data.districtName, data.gnName].filter(Boolean).join(' / ');
  const active = data.layout === 'active';
  const next = data.nextStep;
  const notice = pendingNotice(data);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText step="title" tone="muted">
            {t('m.home.welcome')}
          </AppText>
          <AppText step="display" accessibilityRole="header" numberOfLines={2}>
            {data.displayName}
          </AppText>
          <AppText step="body" tone="muted">
            {active ? t('m.home.memberActive') : t('m.home.accountReady')}
          </AppText>
        </View>
        <View style={styles.headerActions}>
          <LanguageToggle value={language} onChange={(next) => void chooseLanguage(next)} label={t('m.welcome.language')} />
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `${t('m.home.notifications')}, ${t('m.home.unread', { count: unread })}` : t('m.home.notifications')}
            style={styles.bell}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {unread > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
      </View>

      <MemberCardPreview name={data.displayName} memberCode={member.memberCode} place={place} active={active} />

      {active ? null : (
        <StatusNotice
          title={t(notice.title)}
          body={t(notice.body)}
          link={t('m.home.viewVerification')}
          onPress={() => router.push('/verify')}
        />
      )}

      {active && next ? (
        <SurfaceCard accent>
          <AppText step="caption" tone="muted">
            {t('m.home.nextStep')}
          </AppText>
          <AppText step="card">{t(`m.home.next_${next.kind}`)}</AppText>
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
      <View style={styles.grid}>
        {data.quickActions.map((feature) => (
          <FeatureTile key={feature.key} feature={feature} />
        ))}
      </View>

      {active ? (
        <>
          <View style={styles.sectionRow}>
            <AppText step="section" accessibilityRole="header" style={styles.flex}>
              {t('m.home.comingUp')}
            </AppText>
            <Pressable onPress={() => router.push('/events')} accessibilityRole="link" hitSlop={10}>
              <AppText step="body" tone="link">
                {t('m.common.seeAll')}
              </AppText>
            </Pressable>
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
      ) : (
        <Pressable
          onPress={() => router.push('/verify')}
          accessibilityRole="link"
          accessibilityLabel={`${t('m.home.memberFeatures')}. ${t('m.home.memberFeaturesBody')} ${t('m.home.seeNextSteps')}`}
          style={styles.locked}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
          <View style={styles.flex}>
            <AppText step="card" weight={400} tone="secondary">
              {t('m.home.memberFeatures')}
            </AppText>
            <AppText step="secondary" tone="muted">
              {t('m.home.memberFeaturesBody')}
            </AppText>
            <AppText step="secondary" tone="link">
              {t('m.home.seeNextSteps')}
            </AppText>
          </View>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingTop: spacing[2] },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: 34 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.error },
  sectionTitle: { marginTop: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] },
  flex: { flex: 1 },
  locked: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.inputBorder,
  },
});
