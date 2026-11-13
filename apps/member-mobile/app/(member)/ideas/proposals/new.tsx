import type { ProposalDetail } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { confirmAction, Notice, Screen, useApiQuery, useMember } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import {
  chosenArea,
  fieldsFrom,
  newProposalDraft,
  optionalParts,
  parseProposalDraft,
  proposalDraftStorage,
  type ProposalFields,
} from '@/features/proposals/draft';
import { ProposalForm } from '@/features/proposals/ProposalForm';
import { api } from '@/lib/api';
import { useDeviceDraft } from '@/lib/deviceDraft';

/**
 * M16 New development proposal, or (with ?revise=<id>) a proposal the moderators returned with
 * "Needs changes", opened again with what it said. A new one is kept on the device as it is
 * written; its receipt is the proposal screen (M17).
 */
export default function NewProposalScreen() {
  const { revise } = useLocalSearchParams<{ revise?: string }>();
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      {revise ? <Revision id={revise} /> : <NewProposal />}
    </Screen>
  );
}

function NewProposal() {
  const { t } = useTranslation();
  const member = useMember();
  const { draft, update, reset } = useDeviceDraft(proposalDraftStorage, member.id, newProposalDraft, parseProposalDraft);

  if (!draft) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={t('m.common.loading')}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const send = async (fields: ProposalFields) => {
    const area = chosenArea(fields.area);
    if (!area || !fields.category) return; // the form checked both before review
    const sent = await api().submitProposal({
      clientReference: draft.clientReference,
      title: fields.title.trim(),
      category: fields.category,
      area,
      problem: fields.problem.trim(),
      solution: fields.solution.trim(),
      benefit: fields.benefit.trim(),
      ...optionalParts(fields),
    });
    // The receipt opens first, so the emptied form never shows; then no copy stays on the device.
    router.replace({ pathname: '/ideas/proposals/[id]', params: { id: sent.id, receipt: '1' } });
    reset();
  };

  const discard = async () => {
    const yes = await confirmAction({
      title: t('m.proposals.discardTitle'),
      message: t('m.proposals.discardBody'),
      confirmLabel: t('m.proposals.discardDraft'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (yes) reset();
  };
  const started = Boolean(draft.title.trim() || draft.problem.trim() || draft.solution.trim() || draft.benefit.trim());

  return (
    <ProposalForm
      fields={draft}
      onChange={(change) => update((current) => ({ ...current, ...change(current) }))}
      withArea
      kept
      onDiscard={started ? () => void discard() : undefined}
      sendLabel={t('m.proposals.send')}
      send={send}
    />
  );
}

function Revision({ id }: { id: string }) {
  const { t } = useTranslation();
  const proposal = useApiQuery(() => api().getProposal(id), [id]);
  return (
    <FeatureQueryView feature="proposals" query={proposal}>
      {(data) =>
        data.mine && data.stage === 'rejected' ? (
          <RevisionForm proposal={data} />
        ) : (
          <Notice tone="warning">{t('m.proposals.cannotRevise')}</Notice>
        )
      }
    </FeatureQueryView>
  );
}

function RevisionForm({ proposal }: { proposal: ProposalDetail }) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<ProposalFields>(() => fieldsFrom(proposal));
  const send = async (sending: ProposalFields) => {
    if (!sending.category) return;
    await api().reviseProposal(proposal.id, {
      title: sending.title.trim(),
      category: sending.category,
      problem: sending.problem.trim(),
      solution: sending.solution.trim(),
      benefit: sending.benefit.trim(),
      ...optionalParts(sending),
    });
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/ideas/proposals/[id]', params: { id: proposal.id } });
  };
  return (
    <>
      {proposal.stageReason ? (
        <Notice tone="warning" title={t('m.proposals.moderatorReason')}>
          {proposal.stageReason}
        </Notice>
      ) : null}
      <ProposalForm
        fields={fields}
        onChange={(change) => setFields(change)}
        withArea={false}
        kept={false}
        sendLabel={t('m.proposals.sendRevision')}
        send={send}
      />
    </>
  );
}

const styles = StyleSheet.create({ loading: { paddingVertical: spacing[8], alignItems: 'center' } });
