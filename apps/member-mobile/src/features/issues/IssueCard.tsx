import type { IssueSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, IconTile, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { IssueStatusTag } from './IssueStatusTag';
import { CATEGORY_ICONS, CATEGORY_TINTS } from './labels';

/** One issue in My area or My reports: its title, case ID, category and status; opens H06/H09. */
export function IssueCard({ issue }: { issue: IssueSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(issue.titleEn, issue.titleTa) || t('m.issues.untitled');
  const category = t(`m.issues.category_${issue.category}`);
  const status = t(`m.issues.status_${issue.status}`);
  const updated = t('m.issues.updatedOn', { date: formatDate(issue.updatedAt, language) });

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/issues/[id]', params: { id: issue.id } })}
      accessibilityLabel={`${title}. ${category}. ${status}. ${t('m.issues.caseId')} ${issue.caseNumber}. ${updated}`}
      accessibilityHint={t('m.issues.opensIssue')}>
      <View style={styles.row}>
        <IconTile icon={CATEGORY_ICONS[issue.category]} tint={CATEGORY_TINTS[issue.category]} size={40} />
        <View style={styles.text}>
          <AppText step="card">{title}</AppText>
          <AppText step="secondary" tone="muted" mono>
            {issue.caseNumber}
          </AppText>
          <AppText step="secondary" tone="secondary">
            {category}
          </AppText>
        </View>
      </View>
      <View style={styles.tags}>
        <IssueStatusTag status={issue.status} />
        {issue.mine ? <StatusTag tone="neutral" label={t('m.issues.yourReport')} /> : null}
        {issue.following ? <StatusTag tone="neutral" label={t('m.issues.following')} /> : null}
      </View>
      <AppText step="caption" tone="muted">
        {updated}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
