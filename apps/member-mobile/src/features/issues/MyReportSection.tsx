import type { IssueDetail, MyIssueReport } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDateTime, Notice, StatusTag, SurfaceCard, useLanguage } from '@my-people/mobile-ui';

import { AddInformationForm } from './AddInformationForm';
import { ClosureResponse } from './ClosureResponse';

type Props = {
  issue: IssueDetail;
  report: MyIssueReport;
  /** The receipt banner already says what happens next. */
  receipt: boolean;
  reload: () => void;
};

/**
 * H09, only for the reporter: a question from the GN coordinator to answer (FR-WEB-016), a join
 * with another case, the closure to rate or challenge (FR-RPT-016), the next step in plain words,
 * and what they sent.
 */
export function MyReportSection({ issue, report, receipt, reload }: Props) {
  const { t } = useTranslation();
  const [replied, setReplied] = useState(false);
  const needsDetails = issue.status === 'needs_details';

  return (
    <>
      {report.linkedTo ? (
        <Notice tone="info" title={t('m.issues.linkedTitle', { caseNumber: report.linkedTo })}>
          {t('m.issues.linkedBody', { caseNumber: report.linkedTo })}
        </Notice>
      ) : null}

      {replied ? <Notice tone="success">{t('m.issues.replySent')}</Notice> : null}

      {needsDetails && report.returnedQuestion ? (
        <>
          <SurfaceCard style={styles.question}>
            <AppText step="caption" tone="warning">
              {t('m.issues.questionTitle')}
            </AppText>
            <AppText step="section">{report.returnedQuestion}</AppText>
          </SurfaceCard>
          {issue.canAddInformation ? (
            <AddInformationForm
              issueId={issue.id}
              mode="reply"
              onSent={() => {
                setReplied(true);
                reload();
              }}
            />
          ) : null}
        </>
      ) : null}

      <ClosureResponse issueId={issue.id} report={report} onAnswered={reload} />

      {!receipt && report.nextStep ? (
        <SurfaceCard accent style={styles.card}>
          <AppText step="caption" tone="primary">
            {t('m.issues.nextStep')}
          </AppText>
          <AppText step="body">{t(`m.issues.next_${report.nextStep}`)}</AppText>
        </SurfaceCard>
      ) : null}

      <SentReport report={report} />

      {issue.canAddInformation && !needsDetails ? <AddInformationForm issueId={issue.id} mode="add" onSent={reload} /> : null}
    </>
  );
}

/** What the reporter sent, in their own words, and who may see it. */
function SentReport({ report }: { report: MyIssueReport }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const place = report.locationKind === 'my_gn' ? t('m.issues.placeMyGn') : (report.locationText ?? '');
  const publicState = report.visibility === 'public' && report.publicState !== 'none' ? report.publicState : null;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.issues.whatYouSent')}
      </AppText>
      <AppText step="caption" tone="muted">
        {t('m.issues.sentOn', { date: formatDateTime(report.createdAt, language) })}
      </AppText>
      <Detail label={t('m.issues.titleLabel')} value={report.title} />
      <Detail label={t('m.issues.place')} value={place} />
      <Detail label={t('m.issues.descriptionLabel')} value={report.description} />
      <Detail label={t('m.issues.photos')} value={t('m.issues.photoCount', { count: report.photos })} />
      <View style={styles.detail}>
        <AppText step="label">{t('m.issues.visibility')}</AppText>
        <AppText step="body" tone="secondary">
          {report.visibility === 'public' ? t('m.issues.visibilityPublic') : t('m.issues.visibilityTeam')}
        </AppText>
        {publicState ? (
          <StatusTag
            tone={publicState === 'published' ? 'verified' : publicState === 'withheld' ? 'neutral' : 'pending'}
            label={t(`m.issues.publicState_${publicState}`, { defaultValue: publicState })}
          />
        ) : null}
      </View>
    </SurfaceCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detail}>
      <AppText step="label">{label}</AppText>
      <AppText step="body" tone="secondary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  question: { gap: spacing[2], borderColor: colors.warning, borderWidth: 2, backgroundColor: colors.warningBackground },
  detail: { gap: 2, paddingVertical: spacing[1] },
});
