import type { BudgetProject } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
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
import { useAreaName } from '@/features/area/useAreaName';
import { rupees } from '@/features/proposals/labels';
import { api } from '@/lib/api';

/**
 * M25 Budget project detail: a development proposal approved for planning, its estimated cost and
 * the recorded financial and legal reviews (FR-PBG-002). Once certified and funded, its allocation,
 * every spending entry with its evidence and the completion evidence (FR-PBG-008).
 */
export default function BudgetProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useApiQuery(() => api().getBudgetProject(id), [id]);
  useReloadOnFocus(project.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={project.reload}
      refreshing={project.loading && project.data !== undefined}>
      <FeatureQueryView feature="budgeting" query={project}>
        {(data) => <ProjectBody project={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function ProjectBody({ project }: { project: BudgetProject }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const areaName = useAreaName(project.areaKey);
  const reviews = [
    { key: 'financial', label: t('m.budgeting.financialReview'), review: project.financialReview },
    { key: 'legal', label: t('m.budgeting.legalReview'), review: project.legalReview },
  ];
  const certified = project.funded !== null && project.funded !== undefined;

  return (
    <>
      <View style={styles.header}>
        {certified ? (
          <View style={styles.tags}>
            <StatusTag
              label={project.funded ? t('m.budgeting.funded') : t('m.budgeting.notFunded')}
              tone={project.funded ? 'verified' : 'neutral'}
            />
            {project.rank ? <StatusTag label={t('m.budgeting.rank', { rank: project.rank })} tone="neutral" /> : null}
          </View>
        ) : null}
        <AppText step="page" accessibilityRole="header">
          {localized(project.titleEn, project.titleTa)}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {project.proposalRef}
        </AppText>
        {areaName ? (
          <AppText step="secondary" tone="secondary">
            {areaName}
          </AppText>
        ) : null}
        <AppText step="body" tone="secondary">
          {localized(project.summaryEn, project.summaryTa)}
        </AppText>
      </View>

      <SurfaceCard style={styles.card}>
        <DetailRow label={t('m.budgeting.cost')} value={rupees(project.estimatedCost, language)} />
        <DetailRow label={t('m.budgeting.category')} value={t(`m.proposals.category_${project.category}`)} />
        {project.votes !== null && project.votes !== undefined ? (
          <DetailRow label={t('m.budgeting.votes')} value={String(project.votes)} />
        ) : null}
        <Button
          label={localized(project.cycleTitleEn, project.cycleTitleTa)}
          variant="quiet"
          icon="wallet-outline"
          onPress={() => router.push({ pathname: '/budgeting/[id]', params: { id: project.cycleId } })}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.budgeting.reviewsTitle')}
        </AppText>
        {reviews.map(({ key, label, review }) =>
          review ? (
            <View key={key} style={styles.entry}>
              <AppText step="label">{label}</AppText>
              <AppText step="body" tone="secondary">
                {localized(review.noteEn, review.noteTa)}
              </AppText>
              <AppText step="caption" tone="muted">
                {t('m.budgeting.reviewRecorded', { ref: review.reference, date: formatDate(review.recordedAt, language) })}
              </AppText>
            </View>
          ) : null,
        )}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.budgeting.proposal')}
        </AppText>
        <AppText step="caption" tone="muted">
          {t('m.budgeting.fromProposal')}
        </AppText>
        <DetailRow label={t('m.budgeting.problem')} value={project.problem} />
        <DetailRow label={t('m.budgeting.solution')} value={project.solution} />
        <DetailRow label={t('m.budgeting.benefit')} value={project.benefit} />
      </SurfaceCard>

      {project.allocated ? <Funding project={project} /> : null}
    </>
  );
}

/** FR-PBG-008: what was allocated, every spending entry with its evidence, and completion. */
function Funding({ project }: { project: BudgetProject }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.budgeting.fundingTitle')}
      </AppText>
      <DetailRow label={t('m.budgeting.allocated')} value={rupees(project.allocated ?? 0, language)} />
      <DetailRow label={t('m.budgeting.spent')} value={rupees(project.spent, language)} />
      <View style={styles.tags}>
        {project.completion ? (
          <StatusTag
            label={t('m.budgeting.completedOn', { date: formatDate(project.completion.completedOn, language) })}
            tone="verified"
          />
        ) : (
          <StatusTag label={t('m.budgeting.inProgress')} tone="pending" />
        )}
      </View>
      {project.completion ? (
        <View style={styles.entry}>
          {project.completion.noteEn ? (
            <AppText step="body" tone="secondary">
              {localized(project.completion.noteEn, project.completion.noteTa ?? '')}
            </AppText>
          ) : null}
          <AppText step="caption" tone="muted">
            {t('m.budgeting.evidence', { ref: project.completion.evidenceRef })}
          </AppText>
        </View>
      ) : null}
      <AppText step="label">{t('m.budgeting.spending')}</AppText>
      {project.expenditures.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.budgeting.noSpending')}
        </AppText>
      ) : (
        project.expenditures.map((item, index) => (
          <View key={item.id} style={[styles.entry, index > 0 && styles.divider]}>
            <AppText step="body">{`${rupees(item.amount, language)} · ${formatDate(item.spentOn, language)}`}</AppText>
            <AppText step="secondary" tone="secondary">
              {localized(item.descriptionEn, item.descriptionTa)}
            </AppText>
            <AppText step="caption" tone="muted">
              {t('m.budgeting.evidence', { ref: item.evidenceRef })}
            </AppText>
          </View>
        ))
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[3] },
  entry: { gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
});
