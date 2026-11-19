import type { BudgetCycle, BudgetReceipt } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  confirmAction,
  formatDate,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useMember,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { saveReceipt } from '@/features/budgeting/receiptStore';
import { rupees } from '@/features/proposals/labels';
import { copyText } from '@/features/referrals/copyOrShare';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M26 Cast budgeting ballot. Online only. Eligibility is checked again by the server when the
 * ballot is sent (FR-PBG-003); a member votes once per cycle (FR-PBG-004). The receipt code is
 * shown once, after the server has committed the ballot, and confirms it was counted without
 * revealing the choice (FR-PBG-005).
 */
export default function BallotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cycle = useApiQuery(() => api().getBudgetCycle(id), [id]);
  const [receipt, setReceipt] = useState<BudgetReceipt | null>(null);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      {receipt ? (
        <Received cycleId={id} receipt={receipt} />
      ) : (
        <FeatureQueryView feature="budgeting" query={cycle}>
          {(data) => <BallotBody cycle={data} onCast={setReceipt} />}
        </FeatureQueryView>
      )}
    </Screen>
  );
}

function BallotBody({ cycle, onCast }: { cycle: BudgetCycle; onCast: (receipt: BudgetReceipt) => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const member = useMember();
  const [chosen, setChosen] = useState<string[]>([]);
  const max = cycle.rules.maxChoices;
  const titles = new Map(cycle.projects.map((project) => [project.id, localized(project.titleEn, project.titleTa)]));

  const send = useApiAction(async () => {
    const yes = await confirmAction({
      title: t('m.budgeting.confirmTitle'),
      message: t('m.budgeting.confirmBody', { list: chosen.map((projectId) => titles.get(projectId)).join(', ') }),
      confirmLabel: t('m.budgeting.confirm'),
      cancelLabel: t('m.common.cancel'),
    });
    if (!yes) return;
    const receipt = await api().castBudgetBallot(cycle.id, chosen);
    await saveReceipt(member.id, cycle.id, receipt.receiptCode);
    onCast(receipt);
  });

  if (cycle.participatedOn) {
    return (
      <>
        <Notice tone="info" title={t('m.budgeting.tookPartTitle')}>
          {t('m.budgeting.tookPartBody', { date: formatDate(cycle.participatedOn, language) })}
        </Notice>
        <BackToCycle cycleId={cycle.id} />
      </>
    );
  }
  if (!cycle.canVote || cycle.phase !== 'voting') {
    return (
      <>
        <Notice tone="warning" title={t('m.budgeting.ineligibleTitle')}>
          {t(`m.budgeting.refusals.${cycle.ineligibleReason ?? 'voting_not_open'}`)}
        </Notice>
        <BackToCycle cycleId={cycle.id} />
      </>
    );
  }

  const toggle = (projectId: string, on: boolean) =>
    setChosen((current) => (on ? [...current, projectId] : current.filter((item) => item !== projectId)));
  const full = chosen.length >= max;

  return (
    <>
      <AppText step="page" accessibilityRole="header">
        {localized(cycle.titleEn, cycle.titleTa)}
      </AppText>
      <AppText step="body" tone="secondary">
        {t('m.budgeting.ballotIntro', { count: max })}
      </AppText>
      <Notice tone="info">{t('m.budgeting.onlineOnly')}</Notice>
      <View style={styles.list}>
        {cycle.projects.map((project) => {
          const checked = chosen.includes(project.id);
          return (
            <SurfaceCard key={project.id} style={styles.card}>
              <Checkbox
                label={`${titles.get(project.id)} · ${rupees(project.estimatedCost, language)}`}
                checked={checked}
                disabled={!checked && full}
                onChange={(on) => toggle(project.id, on)}
              />
              <AppText step="secondary" tone="secondary">
                {localized(project.summaryEn, project.summaryTa)}
              </AppText>
              <Button
                label={t('m.budgeting.opensProject')}
                variant="quiet"
                icon="document-text-outline"
                onPress={() => router.push({ pathname: '/budgeting/projects/[id]', params: { id: project.id } })}
              />
            </SurfaceCard>
          );
        })}
      </View>
      <AppText step="label" accessibilityLiveRegion="polite">
        {t('m.budgeting.chosen', { count: chosen.length, max })}
      </AppText>
      {full ? (
        <AppText step="caption" tone="muted">
          {t('m.budgeting.chooseLimit')}
        </AppText>
      ) : null}
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'budgeting')}</Notice> : null}
      <Button
        label={t('m.budgeting.sendBallot')}
        icon="checkmark-circle-outline"
        busy={send.busy}
        disabled={chosen.length === 0}
        onPress={() => void send.run()}
      />
    </>
  );
}

function Received({ cycleId, receipt }: { cycleId: string; receipt: BudgetReceipt }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <ReceiptCard
      title={t('m.budgeting.receiptTitle')}
      referenceLabel={t('m.budgeting.receiptLabel')}
      reference={receipt.receiptCode}
      body={t('m.budgeting.receiptBody')}>
      <Button
        label={copied ? t('m.budgeting.copied') : t('m.budgeting.copy')}
        variant="secondary"
        icon="copy-outline"
        onPress={() => void copyText(receipt.receiptCode).then(setCopied)}
      />
      <BackToCycle cycleId={cycleId} />
    </ReceiptCard>
  );
}

function BackToCycle({ cycleId }: { cycleId: string }) {
  const { t } = useTranslation();
  return (
    <Button
      label={t('m.budgeting.backToCycle')}
      variant="quiet"
      icon="chevron-back"
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace({ pathname: '/budgeting/[id]', params: { id: cycleId } })
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  card: { gap: spacing[2] },
});
