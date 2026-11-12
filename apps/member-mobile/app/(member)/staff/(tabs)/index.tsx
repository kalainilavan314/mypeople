import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { approvalCount, approvesAnything, loadApprovals } from '@/features/staff/approvals/loadApprovals';
import { areaLabel, tierLabel } from '@/features/staff/areaLabel';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

/**
 * S02: the day's work for this person's roles, with counts only for their own
 * areas. Each card opens the queue; nothing here is a decision.
 */
export default function StaffHomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { assignments, permissions, areaNames } = useStaff();
  const reviews = useApiQuery(
    async () => (permissions.has('members.verify') ? api().getIdentityReviewCounts() : null),
    [permissions],
  );
  const approvals = useApiQuery(
    async () => (approvesAnything(permissions) ? approvalCount(await loadApprovals(permissions)) : null),
    [permissions],
  );
  const volunteerAssignments = useApiQuery(() => api().listMyVolunteerAssignments(), []);
  const reload = useCallback(() => {
    reviews.reload();
    approvals.reload();
    volunteerAssignments.reload();
  }, [reviews.reload, approvals.reload, volunteerAssignments.reload]);
  useReloadOnFocus(reload);

  const scans = permissions.has('events.checkin_scan') || permissions.has('events.manage');
  const looksUp = permissions.has('members.view_profile');
  const nothing = !permissions.has('members.verify') && !approvesAnything(permissions) && !scans && !looksUp;

  return (
    <Screen edges={[]} onRefresh={reload} refreshing={reviews.loading || approvals.loading}>
      {assignments.map((assignment) => (
        <StatusTag key={assignment.id} tone="neutral" label={t('s.home.roleIn', { tier: tierLabel(assignment), area: areaLabel(assignment, areaNames, language) })} />
      ))}

      {reviews.data ? (
        <SurfaceCard>
          <AppText step="section">{t('s.home.reviews')}</AppText>
          <AppText step="body" tone="secondary">
            {t('s.home.reviewsBody', {
              waiting: reviews.data.awaitingReview,
              needsUpdate: reviews.data.needsUpdate,
              mine: reviews.data.assignedToMe,
            })}
          </AppText>
          <AppText step="secondary" tone="muted">
            {t('s.home.reviewsWhere')}
          </AppText>
        </SurfaceCard>
      ) : null}

      {approvals.data !== null && approvals.data !== undefined ? (
        <SurfaceCard onPress={() => router.push('/staff/approvals')} accessibilityLabel={t('s.home.approvals')}>
          <AppText step="section">{t('s.home.approvals')}</AppText>
          <AppText step="body" tone="secondary">
            {t('s.home.approvalsBody', { count: approvals.data })}
          </AppText>
        </SurfaceCard>
      ) : null}

      {scans ? (
        <SurfaceCard onPress={() => router.push('/staff/check-in')} accessibilityLabel={t('s.home.events')}>
          <AppText step="section">{t('s.home.events')}</AppText>
          <AppText step="body" tone="secondary">
            {t('s.home.eventsBody')}
          </AppText>
        </SurfaceCard>
      ) : null}

      {volunteerAssignments.data?.length ? (
        <SurfaceCard onPress={() => router.push('/staff/assignments')} accessibilityLabel={t('s.assignments.title')}>
          <AppText step="section">{t('s.assignments.title')}</AppText>
          <AppText step="body" tone="secondary">
            {t('s.assignments.summary', { count: volunteerAssignments.data.length })}
          </AppText>
        </SurfaceCard>
      ) : null}

      {looksUp ? (
        <SurfaceCard onPress={() => router.push('/staff/lookup')} accessibilityLabel={t('s.home.lookup')}>
          <AppText step="section">{t('s.home.lookup')}</AppText>
          <AppText step="body" tone="secondary">
            {t('s.home.lookupBody')}
          </AppText>
        </SurfaceCard>
      ) : null}

      {nothing ? (
        <AppText step="secondary" tone="muted">
          {t('s.home.noTasks')}
        </AppText>
      ) : null}
    </Screen>
  );
}
