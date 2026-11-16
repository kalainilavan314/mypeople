import type { ProposalDetail } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDateTime,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { useAreaName } from '@/features/area/useAreaName';
import { rupees, WITHDRAWABLE } from '@/features/proposals/labels';
import { StageTag } from '@/features/proposals/StageTag';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M17 Proposal status: the stage, the decision reason and the next step in plain words, and every
 * change with the tier that recorded it, never a name (FR-DEV-007). The author can revise it after
 * "Needs changes" and withdraw it while it is still being considered. With receipt=1 it opens as
 * the receipt (M16).
 */
export default function ProposalScreen() {
  const { id, receipt } = useLocalSearchParams<{ id: string; receipt?: string }>();
  const proposal = useApiQuery(() => api().getProposal(id), [id]);
  useReloadOnFocus(proposal.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={proposal.reload}
      refreshing={proposal.loading && proposal.data !== undefined}>
      <FeatureQueryView feature="proposals" query={proposal}>
        {(data) => <ProposalBody proposal={data} receipt={receipt === '1'} reload={proposal.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function ProposalBody({ proposal, receipt, reload }: { proposal: ProposalDetail; receipt: boolean; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const areaName = useAreaName(proposal.areaKey);
  const withdraw = useApiAction(async () => {
    const yes = await confirmAction({
      title: t('m.proposals.withdrawTitle'),
      message: t('m.proposals.withdrawBody'),
      confirmLabel: t('m.proposals.withdraw'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!yes) return;
    await api().withdrawProposal(proposal.id);
    reload();
  });

  return (
    <>
      {receipt && proposal.mine ? (
        <ReceiptCard
          title={t('m.proposals.receiptTitle')}
          referenceLabel={t('m.proposals.reference')}
          reference={proposal.proposalRef}
          body={t('m.proposals.receiptBody')}
        />
      ) : null}

      <View style={styles.header}>
        <AppText step="label" tone="secondary">
          {t(`m.proposals.category_${proposal.category}`)}
        </AppText>
        <AppText step="page" accessibilityRole="header">
          {proposal.title}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {proposal.proposalRef}
        </AppText>
        {areaName ? (
          <AppText step="secondary" tone="secondary">
            {areaName}
          </AppText>
        ) : null}
        <StageTag stage={proposal.stage} />
      </View>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.proposals.whereItStands')}
        </AppText>
        {proposal.stageReason ? <DetailRow label={t('m.proposals.decisionReason')} value={proposal.stageReason} /> : null}
        <DetailRow label={t('m.proposals.nextStep')} value={t(`m.proposals.next_${proposal.stage}`)} />
        {proposal.mine && proposal.stage === 'rejected' ? (
          <Button
            label={t('m.proposals.revise')}
            icon="create-outline"
            onPress={() => router.push({ pathname: '/ideas/proposals/new', params: { revise: proposal.id } })}
          />
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.proposals.details')}
        </AppText>
        <DetailRow label={t('m.proposals.problemLabel')} value={proposal.problem} />
        <DetailRow label={t('m.proposals.solutionLabel')} value={proposal.solution} />
        <DetailRow label={t('m.proposals.benefitLabel')} value={proposal.benefit} />
        {proposal.costEstimate ? <DetailRow label={t('m.proposals.costLabel')} value={rupees(proposal.costEstimate, language)} /> : null}
        {proposal.evidence ? <DetailRow label={t('m.proposals.evidenceLabel')} value={proposal.evidence} /> : null}
      </SurfaceCard>

      {proposal.history.length > 0 ? (
        <SurfaceCard style={styles.history}>
          <AppText step="section" accessibilityRole="header" style={styles.historyHeading}>
            {t('m.proposals.history')}
          </AppText>
          {proposal.history.map((entry, index) => (
            <View key={`${entry.toStage}-${entry.occurredAt}`} style={[styles.entry, index > 0 && styles.divider]}>
              <AppText step="card">{t(`m.profile.activityState_proposal_${entry.toStage}`)}</AppText>
              <AppText step="caption" tone="muted">
                {formatDateTime(entry.occurredAt, language)}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {entry.actorTier ? t('m.proposals.recordedByTier', { tier: entry.actorTier }) : t('m.proposals.recordedByAuthor')}
              </AppText>
              {entry.reason ? (
                <AppText step="secondary" tone="secondary">
                  {entry.reason}
                </AppText>
              ) : null}
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {withdraw.error ? <Notice tone="error">{errorMessage(t, withdraw.error, 'proposals')}</Notice> : null}
      {proposal.mine && WITHDRAWABLE.includes(proposal.stage) ? (
        <Button
          label={t('m.proposals.withdraw')}
          variant="danger"
          icon="close-circle-outline"
          busy={withdraw.busy}
          onPress={() => void withdraw.run()}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
  history: { padding: 0, gap: 0, overflow: 'hidden' },
  historyHeading: { padding: spacing[4], paddingBottom: spacing[2] },
  entry: { gap: 2, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
