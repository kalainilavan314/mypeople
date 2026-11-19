import type { BudgetResultRow, BudgetResults } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDate,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ConsultationNotice } from '@/features/budgeting/ConsultationNotice';
import { turnoutPercent } from '@/features/budgeting/labels';
import { rupees } from '@/features/proposals/labels';
import { api } from '@/lib/api';
import { problemsOf } from '@/lib/errors';

/**
 * M27 Budgeting results: the certified totals only (FR-PBG-007). No one's vote is ever shown, and
 * with fewer than 10 ballots not even the per-project counts. Until two people certify, a calm
 * "not certified yet".
 */
export default function BudgetResultsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const results = useApiQuery(() => api().getBudgetResults(id), [id]);
  useReloadOnFocus(results.reload);
  const notCertified = results.data === undefined && problemsOf(results.error).includes('results_not_certified');

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={results.reload}
      refreshing={results.loading && results.data !== undefined}>
      {notCertified ? (
        <Notice tone="info" title={t('m.budgeting.notCertifiedTitle')}>
          {t('m.budgeting.notCertifiedBody')}
        </Notice>
      ) : (
        <FeatureQueryView feature="budgeting" query={results}>
          {(data) => <ResultsBody results={data} />}
        </FeatureQueryView>
      )}
    </Screen>
  );
}

function ResultsBody({ results }: { results: BudgetResults }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const percent = turnoutPercent(results.ballots, results.eligibleCount);
  const lastCertified = results.certifications[results.certifications.length - 1];

  return (
    <>
      <View style={styles.header}>
        <AppText step="page" accessibilityRole="header">
          {localized(results.cycle.titleEn, results.cycle.titleTa)}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {results.cycle.cycleRef}
        </AppText>
        <AppText step="body" tone="secondary">
          {t('m.budgeting.resultsIntro')}
        </AppText>
      </View>
      <ConsultationNotice />

      <SurfaceCard style={styles.card}>
        <DetailRow label={t('m.budgeting.ballotsCast')} value={String(results.ballots)} />
        {percent !== null && results.eligibleCount ? (
          <DetailRow
            label={t('m.budgeting.turnout')}
            value={t('m.budgeting.turnoutValue', { percent, eligible: results.eligibleCount })}
          />
        ) : null}
        <DetailRow
          label={t('m.budgeting.allocated')}
          value={t('m.budgeting.allocatedTotal', {
            allocated: rupees(results.allocatedTotal, language),
            budget: rupees(results.budget, language),
          })}
        />
        <View style={styles.tags}>
          <StatusTag label={t('m.budgeting.certified')} tone="verified" />
        </View>
        {lastCertified ? (
          <AppText step="caption" tone="muted">
            {t('m.budgeting.certifiedOn', { date: formatDate(lastCertified.certifiedAt, language) })}
          </AppText>
        ) : null}
      </SurfaceCard>

      {!results.countsShown ? <Notice tone="info">{t('m.budgeting.countsHidden')}</Notice> : null}

      <View style={styles.list}>
        {results.rows.map((row) => (
          <ResultCard key={row.project.id} row={row} />
        ))}
      </View>
    </>
  );
}

function ResultCard({ row }: { row: BudgetResultRow }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(row.project.titleEn, row.project.titleTa);
  const funded = row.funded ? t('m.budgeting.funded') : t('m.budgeting.notFunded');
  const votes = row.votes === null || row.votes === undefined ? null : t('m.budgeting.votesCount', { count: row.votes });

  return (
    <SurfaceCard
      style={styles.card}
      onPress={() => router.push({ pathname: '/budgeting/projects/[id]', params: { id: row.project.id } })}
      accessibilityLabel={[t('m.budgeting.rank', { rank: row.rank }), title, funded, votes].filter(Boolean).join('. ')}
      accessibilityHint={t('m.budgeting.opensProject')}>
      <View style={styles.tags}>
        <StatusTag label={funded} tone={row.funded ? 'verified' : 'neutral'} />
        {row.completedOn ? (
          <StatusTag label={t('m.budgeting.completedOn', { date: formatDate(row.completedOn, language) })} tone="verified" />
        ) : null}
      </View>
      <AppText step="label" tone="secondary">
        {t('m.budgeting.rank', { rank: row.rank })}
      </AppText>
      <AppText step="card">{title}</AppText>
      {votes ? <AppText step="body">{votes}</AppText> : null}
      <AppText step="secondary" tone="secondary">
        {`${t('m.budgeting.cost')}: ${rupees(row.project.estimatedCost, language)}`}
      </AppText>
      {row.allocated ? (
        <AppText step="secondary" tone="secondary">
          {`${t('m.budgeting.allocated')}: ${rupees(row.allocated, language)} · ${t('m.budgeting.spent')}: ${rupees(row.spent, language)}`}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  list: { gap: spacing[3] },
});
