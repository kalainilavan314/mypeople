import type { CommitteeActivity } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, SurfaceCard, useLanguage } from '@my-people/mobile-ui';

const STATS = [
  'members',
  'coordinators',
  'secretaries',
  'applications_waiting',
  'joined_recently',
  'left_recently',
  'announcements',
  'meetings_held',
  'meetings_planned',
  'minutes_approved',
  'minutes_waiting',
  'tasks_open',
  'tasks_overdue',
  'tasks_done',
  'volunteer_signups',
  'documents',
  'threads',
  'replies',
  'discussion_waiting',
] as const;

const KEYS: Record<(typeof STATS)[number], keyof CommitteeActivity> = {
  members: 'members',
  coordinators: 'coordinators',
  secretaries: 'secretaries',
  applications_waiting: 'applicationsWaiting',
  joined_recently: 'joinedRecently',
  left_recently: 'leftRecently',
  announcements: 'announcements',
  meetings_held: 'meetingsHeld',
  meetings_planned: 'meetingsPlanned',
  minutes_approved: 'minutesApproved',
  minutes_waiting: 'minutesWaiting',
  tasks_open: 'tasksOpen',
  tasks_overdue: 'tasksOverdue',
  tasks_done: 'tasksDone',
  volunteer_signups: 'volunteerSignups',
  documents: 'documents',
  threads: 'threads',
  replies: 'replies',
  discussion_waiting: 'discussionWaiting',
};

/** FR-COM-009, RPT-23: this committee's activity in numbers only, never another committee's. */
export function ActivityCard({ report }: { report: CommitteeActivity }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.committees.activity')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('s.committees.activitySince', { date: formatDate(report.since, language) })}
      </AppText>
      <View style={styles.grid}>
        {STATS.map((stat) => (
          <View
            key={stat}
            style={styles.stat}
            accessible
            accessibilityLabel={`${t(`s.committees.stat_${stat}`)}: ${String(report[KEYS[stat]])}`}>
            <AppText step="title">{String(report[KEYS[stat]])}</AppText>
            <AppText step="caption" tone="secondary">
              {t(`s.committees.stat_${stat}`)}
            </AppText>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  stat: {
    flexGrow: 1,
    flexBasis: 128,
    minWidth: 0,
    padding: spacing[2],
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceVariant,
    gap: 2,
  },
});
