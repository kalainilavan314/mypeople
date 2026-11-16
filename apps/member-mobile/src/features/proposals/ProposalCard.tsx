import type { ProposalSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, StatusTag, SurfaceCard, useLanguage } from '@my-people/mobile-ui';

import { StageTag } from './StageTag';

/** One development proposal in M15: title, reference, category and stage; opens M17. */
export function ProposalCard({ proposal }: { proposal: ProposalSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const category = t(`m.proposals.category_${proposal.category}`);
  const stage = t(`m.profile.activityState_proposal_${proposal.stage}`);
  const updated = t('m.proposals.updatedOn', { date: formatDate(proposal.updatedAt, language) });
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/ideas/proposals/[id]', params: { id: proposal.id } })}
      accessibilityLabel={`${proposal.title}. ${category}. ${stage}. ${proposal.proposalRef}. ${updated}`}
      accessibilityHint={t('m.proposals.opensProposal')}>
      <AppText step="card">{proposal.title}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {proposal.proposalRef}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {category}
      </AppText>
      <View style={styles.tags}>
        <StageTag stage={proposal.stage} />
        {proposal.mine ? <StatusTag tone="neutral" label={t('m.proposals.yourProposal')} /> : null}
      </View>
      <AppText step="caption" tone="muted">
        {updated}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] } });
