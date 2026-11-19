import type { BudgetCycle } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  formatDateTime,
  MenuRow,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useMember,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { ConsultationNotice } from '@/features/budgeting/ConsultationNotice';
import { PHASE_TONES } from '@/features/budgeting/labels';
import { ReceiptCheck } from '@/features/budgeting/ReceiptCheck';
import { readReceipt } from '@/features/budgeting/receiptStore';
import { rupees } from '@/features/proposals/labels';
import { api } from '@/lib/api';

/**
 * M24 Budgeting cycle overview: the budget, fund source, dates and eligibility rules published
 * before voting opens, the consultation label (FR-PBG-009), the projects on the ballot, and what
 * this member can do now: vote, see that they took part (never their choice), or see the results.
 */
export default function BudgetCycleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cycle = useApiQuery(() => api().getBudgetCycle(id), [id]);
  useReloadOnFocus(cycle.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={cycle.reload}
      refreshing={cycle.loading && cycle.data !== undefined}>
      <FeatureQueryView feature="budgeting" query={cycle}>
        {(data) => <CycleBody cycle={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function CycleBody({ cycle }: { cycle: BudgetCycle }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const areaName = useAreaName(cycle.areaKey);
  const rules = cycle.rules;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.tags}>
          <StatusTag label={t(`m.budgeting.phase_${cycle.phase}`)} tone={PHASE_TONES[cycle.phase]} />
        </View>
        <AppText step="page" accessibilityRole="header">
          {localized(cycle.titleEn, cycle.titleTa)}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {cycle.cycleRef}
        </AppText>
        {areaName ? (
          <AppText step="secondary" tone="secondary">
            {areaName}
          </AppText>
        ) : null}
        <AppText step="body" tone="secondary">
          {localized(rules.descriptionEn, rules.descriptionTa)}
        </AppText>
      </View>

      <ConsultationNotice />
      <WhatYouCanDo cycle={cycle} />

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.budgeting.budget')}
        </AppText>
        <DetailRow label={t('m.budgeting.budget')} value={rupees(cycle.budget, language)} />
        <DetailRow
          label={t('m.budgeting.fundSource')}
          value={`${t(`m.budgeting.fund_${cycle.fundKind}`)} · ${localized(rules.fundSourceEn, rules.fundSourceTa)}`}
        />
        <DetailRow label={t('m.budgeting.votingOpens')} value={formatDateTime(cycle.votingOpensAt, language)} />
        <DetailRow label={t('m.budgeting.votingCloses')} value={formatDateTime(cycle.votingClosesAt, language)} />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.budgeting.rulesTitle')}
        </AppText>
        <DetailRow label={t('m.budgeting.eligibility')} value={localized(rules.eligibilityEn, rules.eligibilityTa)} />
        <DetailRow label={t('m.budgeting.choices')} value={String(rules.maxChoices)} />
        <DetailRow label={t('m.budgeting.method')} value={t('m.budgeting.methodBody')} />
        {rules.statusReason ? <DetailRow label={t('m.budgeting.cancelledReason')} value={rules.statusReason} /> : null}
        {rules.rulesPublishedAt ? (
          <AppText step="caption" tone="muted">
            {t('m.budgeting.publishedOn', { date: formatDate(rules.rulesPublishedAt, language) })}
          </AppText>
        ) : null}
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.budgeting.projectsTitle')}
      </AppText>
      {cycle.projects.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.budgeting.noProjects')}
        </AppText>
      ) : (
        <SurfaceCard style={styles.rows}>
          {cycle.projects.map((project, index) => (
            <MenuRow
              key={project.id}
              first={index === 0}
              icon="document-text-outline"
              tint="brand"
              label={localized(project.titleEn, project.titleTa)}
              hint={`${t('m.budgeting.cost')}: ${rupees(project.estimatedCost, language)}`}
              onPress={() => router.push({ pathname: '/budgeting/projects/[id]', params: { id: project.id } })}
            />
          ))}
        </SurfaceCard>
      )}
    </>
  );
}

/** The one thing this member can do in this cycle now, or why they cannot. */
function WhatYouCanDo({ cycle }: { cycle: BudgetCycle }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const member = useMember();
  const [receipt, setReceipt] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (cycle.participatedOn) void readReceipt(member.id, cycle.id).then((code) => live && setReceipt(code));
    return () => {
      live = false;
    };
  }, [cycle.id, cycle.participatedOn, member.id]);

  const reason = cycle.ineligibleReason ? (
    <Notice tone="warning" title={t('m.budgeting.ineligibleTitle')}>
      {t(`m.budgeting.refusals.${cycle.ineligibleReason}`)}
    </Notice>
  ) : null;

  if (cycle.participatedOn) {
    return (
      <>
        <Notice tone="success" title={t('m.budgeting.tookPartTitle')}>
          {t('m.budgeting.tookPartBody', { date: formatDate(cycle.participatedOn, language) })}
        </Notice>
        <SurfaceCard style={styles.card}>
          {receipt ? (
            <DetailRow label={t('m.budgeting.receiptOnDevice')} value={receipt} mono />
          ) : (
            <AppText step="secondary" tone="secondary">
              {t('m.budgeting.receiptNotOnDevice')}
            </AppText>
          )}
        </SurfaceCard>
        <ReceiptCheck key={receipt ?? 'none'} cycleId={cycle.id} initialCode={receipt} />
        {cycle.phase === 'results' ? <ResultsButton cycleId={cycle.id} /> : null}
      </>
    );
  }
  switch (cycle.phase) {
    case 'voting':
      return cycle.canVote ? (
        <View style={styles.action}>
          <Button
            label={t('m.budgeting.castBallot')}
            icon="checkmark-circle-outline"
            onPress={() => router.push({ pathname: '/budgeting/[id]/ballot', params: { id: cycle.id } })}
          />
          <AppText step="caption" tone="muted">
            {t('m.budgeting.castHint')}
          </AppText>
        </View>
      ) : (
        reason
      );
    case 'upcoming':
      return (
        <>
          <Notice tone="info">{t('m.budgeting.votingNotYet', { date: formatDateTime(cycle.votingOpensAt, language) })}</Notice>
          {reason}
        </>
      );
    case 'counting':
      return <Notice tone="info">{t('m.budgeting.countingBody')}</Notice>;
    case 'results':
      return <ResultsButton cycleId={cycle.id} />;
    default:
      return null;
  }
}

function ResultsButton({ cycleId }: { cycleId: string }) {
  const { t } = useTranslation();
  return (
    <Button
      label={t('m.budgeting.seeResults')}
      variant="secondary"
      icon="stats-chart-outline"
      onPress={() => router.push({ pathname: '/budgeting/[id]/results', params: { id: cycleId } })}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[3] },
  rows: { paddingVertical: 0 },
  action: { gap: spacing[2] },
});
