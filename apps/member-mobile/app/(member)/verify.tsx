import type { IdentityDocumentKind, IdentityReview, RegistrationProgress } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  Checkbox,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  type Tone,
  useApiAction,
  useApiQuery,
  useLocalized,
  useSession,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { DecisionHistory } from '@/features/identity/DecisionHistory';
import { PhotoRow } from '@/features/identity/PhotoRow';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type State = IdentityReview['state'] | 'not_submitted';

const TONE: Record<State, Tone> = {
  not_submitted: 'neutral',
  submitted: 'pending',
  in_review: 'pending',
  needs_update: 'pending',
  verified: 'verified',
  unable_to_verify: 'error',
};

const DOCUMENT_KINDS = new Set<string>(['nic_front', 'nic_back', 'passport_page', 'selfie']);

type Loaded = { progress: RegistrationProgress; review: IdentityReview | null; appealsOpen: boolean };

/**
 * A04 to A12: consent before any upload (BR-008), the route's photos, the
 * declaration and submission, then the review's state, what to correct, the
 * decision history and, after an adverse decision, one appeal (FR-IDV-013).
 * Identity is checked by a person; membership is a separate step.
 */
export default function VerifyScreen() {
  const { t } = useTranslation();
  const { step } = useLocalSearchParams<{ step?: string }>();
  const query = useApiQuery<Loaded>(async () => {
    const [progress, review, features] = await Promise.all([
      api().getMyRegistrationProgress(),
      api().getMyIdentityReview(),
      api().getEnabledFeatures(),
    ]);
    return { progress, review, appealsOpen: features.enabled.includes('identity_appeals') };
  });

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={query.reload}
      refreshing={query.loading && query.data !== undefined}>
      <AppText step="secondary" tone="muted">
        {t('m.verify.subtitle')}
      </AppText>
      <QueryView query={query}>{(data) => <VerifyBody data={data} reload={query.reload} targetStep={step === data.progress.nextStep ? step : data.progress.nextStep} />}</QueryView>
    </Screen>
  );
}

function VerifyBody({ data, reload, targetStep }: { data: Loaded; reload: () => void; targetStep: string | null | undefined }) {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const { progress, review } = data;
  const progressState = progress.reviewState;
  const state: State = review?.state ?? (progressState && progressState in TONE ? progressState as State : 'not_submitted');
  const consented = progress.steps.find((step) => step.name === 'identity_consent')?.done ?? false;
  // The API returns decisions newest first; use the current decision.
  const latest = review?.history[0];
  const requested = new Set(state === 'needs_update' ? (latest?.requestedItems ?? []) : []);
  const photos = progress.steps.filter((step) => DOCUMENT_KINDS.has(step.name));
  const canSend = state === 'not_submitted' || state === 'needs_update';

  return (
    <>
      <SurfaceCard>
        <StatusTag tone={TONE[state]} label={t(`m.verify.status_${state}`)} />
        {review ? (
          <AppText step="secondary" tone="muted" mono>
            {t('m.verify.reference', { ref: review.reviewRef })}
          </AppText>
        ) : null}
      </SurfaceCard>

      {state === 'submitted' || state === 'in_review' ? (
        <>
          <Notice tone="info">{t('m.verify.submitted')}</Notice>
          <Button label={t('m.verify.goHome')} icon="home-outline" onPress={() => router.replace('/')} />
        </>
      ) : null}

      {state === 'needs_update' && latest ? (
        <Notice tone="warning" title={t('m.verify.requestedTitle')}>
          {latest.requestedItems.map((item) => (
            <AppText key={item} step="secondary" tone="warning">
              {`• ${t(`m.verify.item_${item}`, { defaultValue: item })}`}
            </AppText>
          ))}
          {latest.note ? (
            <AppText step="secondary" tone="warning">
              {`${t('m.verify.reviewerNote')}: ${latest.note}`}
            </AppText>
          ) : null}
        </Notice>
      ) : null}

      {canSend && !consented ? <ConsentCard onConsented={reload} /> : null}

      {canSend && consented ? (
        <>
          {targetStep && targetStep !== 'identity_consent' ? (
            <Notice tone="info" title={t('m.setup.nextStep')}>
              {t(`m.setup.step_${targetStep}`)}
            </Notice>
          ) : null}
          <AppText step="section" accessibilityRole="header">
            {t('m.verify.photosTitle')}
          </AppText>
          {photos.map((step) => (
            <PhotoRow
              key={step.name}
              kind={step.name as IdentityDocumentKind}
              received={step.done}
              requested={requested.has(step.name)}
              target={targetStep === step.name || requested.has(step.name)}
              onUploaded={reload}
            />
          ))}
          <SubmitCard
            route={progress.route}
            resubmit={state === 'needs_update'}
            ready={photos.every((step) => step.done)}
            onSent={() => {
              reload();
              void refresh();
            }}
          />
        </>
      ) : null}

      {state === 'unable_to_verify' ? (
        <Notice tone="error" title={t('m.verify.unableTitle')}>
          {latest?.note ?? ''}
        </Notice>
      ) : null}
      {state === 'unable_to_verify' && latest && !latest.appeal && data.appealsOpen ? (
        <SurfaceCard accent>
          <AppText step="section" accessibilityRole="header">{t('m.verify.appealTitle')}</AppText>
          <AppText step="body" tone="secondary">{t('m.verify.appealHint')}</AppText>
          <Button label={t('m.verify.appealTitle')} onPress={() => router.push('/verify/appeal')} />
        </SurfaceCard>
      ) : null}

      {review ? <DecisionHistory review={review} /> : null}
    </>
  );
}

function ConsentCard({ onConsented }: { onConsented: () => void }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [showData, setShowData] = useState(false);
  const notice = useApiQuery(() => api().getIdentityDataNotice());
  const consent = useApiAction(async () => {
    const versions = await api().getNotices();
    await api().giveIdentityConsent(versions.identityReview);
    onConsented();
  });
  return (
    <SurfaceCard accent>
      <AppText step="section" accessibilityRole="header">
        {t('m.verify.consentTitle')}
      </AppText>
      <AppText step="body" tone="secondary">
        {t('m.verify.consentBody')}
      </AppText>
      <Button label={t('m.verify.whatWeKeep')} variant="quiet" icon={showData ? 'chevron-up' : 'chevron-down'} onPress={() => setShowData(!showData)} />
      {showData ? (
        <QueryView query={notice}>
          {(items) => items.map((item, index) => (
            <View key={item.dataEn} style={[styles.dataItem, index > 0 && styles.dataDivider]}>
              <AppText step="label">{localized(item.dataEn, item.dataTa)}</AppText>
              <AppText step="secondary" tone="secondary">
                {localized(item.purposeEn, item.purposeTa)}
              </AppText>
              <AppText step="secondary" tone="muted">
                {localized(item.retentionEn, item.retentionTa)}
              </AppText>
            </View>
          ))}
        </QueryView>
      ) : null}
      {consent.error ? <Notice tone="error">{errorMessage(t, consent.error)}</Notice> : null}
      <Button label={t('m.verify.consentAction')} busy={consent.busy} onPress={() => void consent.run()} />
    </SurfaceCard>
  );
}

function SubmitCard({ route, resubmit, ready, onSent }: { route: 'nic' | 'passport'; resubmit: boolean; ready: boolean; onSent: () => void }) {
  const { t } = useTranslation();
  const [declared, setDeclared] = useState(false);
  const submit = useApiAction(async () => {
    await api().submitIdentityReview(route, true);
    onSent();
  });
  return (
    <SurfaceCard>
      <Checkbox label={t('m.verify.declaration')} checked={declared} onChange={setDeclared} />
      {submit.error ? <Notice tone="error">{errorMessage(t, submit.error)}</Notice> : null}
      <Button
        label={resubmit ? t('m.verify.resubmit') : t('m.verify.submit')}
        busy={submit.busy}
        busyLabel={t('m.common.sending')}
        disabled={!ready || !declared}
        onPress={() => void submit.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  dataItem: { gap: 2, paddingVertical: spacing[2] },
  dataDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
