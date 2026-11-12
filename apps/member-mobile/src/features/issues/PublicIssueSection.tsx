import type { IssueDetail } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  SurfaceCard,
  useApiAction,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { AddInformationForm } from './AddInformationForm';
import { issueErrorMessage } from './issueErrors';

/**
 * H06 for members in the area: only the moderated public summary and the approved additions,
 * never who reported it or how to reach them. Members may follow it (FR-RPT-005) and add what
 * they know (FR-RPT-006).
 */
export function PublicIssueSection({ issue, reload }: { issue: IssueDetail; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const summary = issue.summaryEn ? localized(issue.summaryEn, issue.summaryTa ?? '') : null;
  const follow = useApiAction(async () => {
    await api().setIssueFollowing(issue.id, !issue.following);
    reload();
  });

  return (
    <>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.issues.summary')}
        </AppText>
        <AppText step="body" tone={summary ? 'default' : 'muted'}>
          {summary ?? t('m.issues.noSummary')}
        </AppText>
      </SurfaceCard>

      {issue.canFollow || issue.following ? (
        <SurfaceCard style={styles.card}>
          <AppText step="secondary" tone="secondary">
            {issue.following ? t('m.issues.followingBody') : t('m.issues.followBody')}
          </AppText>
          <Button
            label={issue.following ? t('m.issues.unfollow') : t('m.issues.follow')}
            icon={issue.following ? 'notifications-off-outline' : 'notifications-outline'}
            variant={issue.following ? 'secondary' : 'primary'}
            busy={follow.busy}
            onPress={() => void follow.run()}
          />
          {follow.error ? <Notice tone="error">{issueErrorMessage(t, follow.error)}</Notice> : null}
        </SurfaceCard>
      ) : null}

      {issue.communityUpdates.length > 0 ? (
        <>
          <AppText step="section" accessibilityRole="header">
            {t('m.issues.communityUpdates')}
          </AppText>
          <SurfaceCard style={styles.list}>
            {issue.communityUpdates.map((update, index) => (
              <View key={`${update.createdAt}-${index}`} style={[styles.item, index > 0 && styles.itemDivider]}>
                <AppText step="body">{update.body}</AppText>
                <AppText step="caption" tone="muted">
                  {formatDateTime(update.createdAt, language)}
                </AppText>
              </View>
            ))}
          </SurfaceCard>
        </>
      ) : null}

      {issue.canAddInformation ? <AddInformationForm issueId={issue.id} mode="add" onSent={reload} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { padding: spacing[4], gap: spacing[1] },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
