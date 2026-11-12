import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import { AppText, formatDateTime, Screen, SurfaceCard, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

// Each kind's states already have words elsewhere in the app.
const STATE_KEYS: Record<string, string> = {
  identity_review: 'm.verify.status_',
  appeal: 'm.verify.appealState_',
  event: 'm.events.',
  removal_request: 'm.gallery.state_',
  area_change: 'm.profile.areaState_',
  privacy_request: 'm.profile.requestState_',
  volunteer_offer: 'm.profile.activityState_volunteer_offer_',
  idea: 'm.profile.activityState_idea_',
  survey_response: 'm.profile.activityState_survey_response_',
  proposal: 'm.profile.activityState_proposal_',
  course: 'm.profile.activityState_course_',
};

// An issue report's state is its case stage; the member sees the same words as on the report.
const ISSUE_STATUS: Record<string, string> = {
  gn: 'received',
  returned: 'needs_details',
  ds: 'under_review',
  district: 'under_review',
  regional: 'under_review',
  executive: 'under_review',
  implementation: 'in_progress',
  resolved: 'resolved',
  declined: 'declined',
};

function stateKey(kind: string, state: string): string {
  if (kind === 'issue_report') {
    const status = ISSUE_STATUS[state];
    return status ? `m.issues.status_${status}` : `m.profile.activityState_issue_report_${state}`;
  }
  return `${STATE_KEYS[kind] ?? ''}${state}`;
}

/** Receipts that have a screen open it; the others are records only. */
function issueStatus(kind: string, targetId: string): (() => void) | undefined {
  if (kind === 'issue_report') return () => router.push({ pathname: '/issues/[id]', params: { id: targetId } });
  return undefined;
}

/** P03 My Activity: receipts for what the member has asked for or taken part in, newest first. */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const activity = useApiQuery(() => api().listMyActivity({ limit: 100 }));
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={activity.reload}
      refreshing={activity.loading && activity.data !== undefined}>
      <QueryView query={activity}>
        {(items) =>
          items.length === 0 ? (
            <AppText step="secondary" tone="muted">
              {t('m.profile.activityEmpty')}
            </AppText>
          ) : (
            <SurfaceCard style={styles.list}>
              {items.map((item, index) => (
                <Pressable
                  key={`${item.kind}-${item.reference}-${item.at}`}
                  onPress={issueStatus(item.kind, item.targetId)}
                  disabled={!issueStatus(item.kind, item.targetId)}
                  accessibilityRole={issueStatus(item.kind, item.targetId) ? 'link' : 'text'}
                  style={({ pressed }) => [styles.item, index > 0 && styles.itemDivider, pressed && styles.pressed]}>
                  <AppText step="caption" tone="primary">
                    {t(`m.profile.activity_${item.kind}`)}
                  </AppText>
                  {item.title ? <AppText step="card">{item.title}</AppText> : null}
                  <AppText step="secondary" tone="muted" mono>
                    {item.reference}
                  </AppText>
                  <AppText step="secondary" tone="secondary">
                    {t(stateKey(item.kind, item.state), { defaultValue: item.state.replace(/_/g, ' ') })}
                  </AppText>
                  <AppText step="caption" tone="muted">
                    {formatDateTime(item.at, language)}
                  </AppText>
                </Pressable>
              ))}
            </SurfaceCard>
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { gap: spacing[1], padding: spacing[3] },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { backgroundColor: colors.surfaceVariant },
});
