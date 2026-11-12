import type { IssueDetail } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDate,
  IconTile,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { IssuesQueryView } from '@/features/issues/IssuesQueryView';
import { IssueStatusTag } from '@/features/issues/IssueStatusTag';
import { IssueStepper } from '@/features/issues/IssueStepper';
import { CATEGORY_ICONS, CATEGORY_TINTS } from '@/features/issues/labels';
import { MyReportSection } from '@/features/issues/MyReportSection';
import { PublicIssueSection } from '@/features/issues/PublicIssueSection';
import { ReceiptBanner } from '@/features/issues/ReceiptBanner';
import { api } from '@/lib/api';

/**
 * H06 Local issue and H09 My report and progress, one screen: everyone sees the case ID, status,
 * who holds it and the four-stage stepper (OD-13); the reporter also sees their own report, and
 * others the moderated public summary. With receipt=1 it opens as the receipt (FR-RPT-014).
 */
export default function IssueScreen() {
  const { id, receipt } = useLocalSearchParams<{ id: string; receipt?: string }>();
  const issue = useApiQuery(() => api().getIssue(id), [id]);
  useReloadOnFocus(issue.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={issue.reload} refreshing={issue.loading && issue.data !== undefined}>
      <IssuesQueryView query={issue}>
        {(data) => <IssueBody issue={data} receipt={receipt === '1'} reload={issue.reload} />}
      </IssuesQueryView>
    </Screen>
  );
}

function IssueBody({ issue, receipt, reload }: { issue: IssueDetail; receipt: boolean; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(issue.titleEn, issue.titleTa) || t('m.issues.untitled');
  const closingSummary = issue.closingSummaryEn ? localized(issue.closingSummaryEn, issue.closingSummaryTa ?? '') : null;

  return (
    <>
      {receipt && issue.report ? <ReceiptBanner caseNumber={issue.caseNumber} nextStep={issue.report.nextStep} /> : null}

      <View style={styles.header}>
        <View style={styles.categoryRow}>
          <IconTile icon={CATEGORY_ICONS[issue.category]} tint={CATEGORY_TINTS[issue.category]} size={40} />
          <AppText step="label" tone="secondary" style={styles.flex}>
            {t(`m.issues.category_${issue.category}`)}
          </AppText>
        </View>
        <AppText step="page" accessibilityRole="header">
          {title}
        </AppText>
        <AppText step="secondary" tone="muted" accessibilityLabel={`${t('m.issues.caseId')} ${issue.caseNumber}`}>
          {`${t('m.issues.caseId')}: `}
          <AppText step="secondary" tone="secondary" mono>
            {issue.caseNumber}
          </AppText>
        </AppText>
        <IssueStatusTag status={issue.status} />
        {issue.responsibleTier ? (
          <View style={styles.detail}>
            <AppText step="label">{t('m.issues.handledBy')}</AppText>
            <AppText step="body" tone="secondary">
              {t(`m.issues.tier_${issue.responsibleTier}`)}
            </AppText>
          </View>
        ) : null}
      </View>

      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.issues.progress')}
        </AppText>
        <IssueStepper steps={issue.steps} stage={issue.stage} status={issue.status} />
      </SurfaceCard>

      {issue.status === 'resolved' && closingSummary ? (
        <SurfaceCard>
          <AppText step="section" accessibilityRole="header">
            {t('m.issues.closingTitle')}
          </AppText>
          <AppText step="body">{closingSummary}</AppText>
          {issue.closedAt ? (
            <AppText step="caption" tone="muted">
              {t('m.issues.closedOn', { date: formatDate(issue.closedAt, language) })}
            </AppText>
          ) : null}
        </SurfaceCard>
      ) : null}
      {issue.status === 'declined' ? (
        <AppText step="body" tone="secondary">
          {t('m.issues.declinedBody')}
        </AppText>
      ) : null}

      {issue.report ? (
        <MyReportSection issue={issue} report={issue.report} receipt={receipt} reload={reload} />
      ) : (
        <PublicIssueSection issue={issue} reload={reload} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  detail: { gap: 2 },
});
