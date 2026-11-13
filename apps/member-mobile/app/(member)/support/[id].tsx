import type { MySupportRequest } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
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
import { ReceiptCard } from '@/components/ReceiptCard';
import { AppealForm } from '@/features/support/AppealForm';
import { APPEAL_TONES, STATE_TONES } from '@/features/support/labels';
import { api } from '@/lib/api';

/**
 * M13 My support request: its AS- reference, where it stands, each decision with its reason, the
 * help delivered, and complaints or appeals (M14). The reference reveals nothing about the person,
 * place or kind of help.
 */
export default function SupportRequestStatusScreen() {
  const { id, receipt } = useLocalSearchParams<{ id: string; receipt?: string }>();
  const request = useApiQuery(() => api().getMySupportRequest(id), [id]);
  useReloadOnFocus(request.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={request.reload} refreshing={request.loading && request.data !== undefined}>
      <FeatureQueryView feature="support" query={request}>
        {(data) => <RequestBody request={data} receipt={receipt === '1'} reload={request.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function RequestBody({ request, receipt, reload }: { request: MySupportRequest; receipt: boolean; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const appealed = new Set(request.appeals.map((appeal) => appeal.decisionId));
  const open = request.decisions.filter((decision) => !appealed.has(decision.id));

  return (
    <>
      {receipt ? (
        <ReceiptCard
          title={t('m.support.receiptTitle')}
          referenceLabel={t('m.support.reference')}
          reference={request.caseRef}
          body={request.emergency ? t('m.support.receiptEmergency') : t('m.support.receiptBody')}
        />
      ) : null}

      <View style={styles.header}>
        <AppText step="page" accessibilityRole="header" mono>
          {request.caseRef}
        </AppText>
        <AppText step="body" tone="secondary">
          {t(`m.support.category_${request.category}`)}
        </AppText>
        <StatusTag tone={STATE_TONES[request.state]} label={t(`m.support.state_${request.state}`)} />
        <AppText step="secondary" tone="secondary">
          {t(`m.support.stateHelp_${request.state}`)}
        </AppText>
        <AppText step="caption" tone="muted">
          {t('m.support.sentOn', { date: formatDate(request.createdAt, language) })}
        </AppText>
      </View>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.support.decisions')}
        </AppText>
        {request.decisions.length === 0 ? (
          <AppText step="secondary" tone="muted">
            {t('m.support.noDecision')}
          </AppText>
        ) : (
          request.decisions.map((decision, index) => (
            <View key={decision.id} style={[styles.entry, index > 0 && styles.divider]}>
              <AppText step="card">{t(`m.support.outcome_${decision.outcome}`)}</AppText>
              <AppText step="caption" tone="muted">
                {formatDate(decision.decidedAt, language)}
              </AppText>
              <DetailRow label={t('m.support.programme')} value={decision.programmeNameEn} />
              <DetailRow label={t('m.support.reason')} value={localized(decision.reasonEn, decision.reasonTa)} />
              {decision.replacesId ? (
                <AppText step="caption" tone="muted">
                  {t('m.support.replacesEarlier')}
                </AppText>
              ) : null}
            </View>
          ))
        )}
      </SurfaceCard>

      {request.deliveries.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.support.delivered')}
          </AppText>
          {request.deliveries.map((delivery, index) => (
            <View key={`${delivery.deliveredOn}-${index}`} style={[styles.entry, index > 0 && styles.divider]}>
              <AppText step="card">{`${delivery.kind}: ${delivery.amount}`}</AppText>
              <AppText step="caption" tone="muted">
                {formatDate(delivery.deliveredOn, language)}
              </AppText>
              <DetailRow label={t('m.support.provider')} value={delivery.provider} />
              <DetailRow label={t('m.support.evidence')} value={delivery.evidence} />
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {request.appeals.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.support.appeals')}
          </AppText>
          {request.appeals.map((appeal, index) => (
            <View key={appeal.id} style={[styles.entry, index > 0 && styles.divider]}>
              <AppText step="card">{t(`m.support.kind_${appeal.kind}`)}</AppText>
              <StatusTag tone={APPEAL_TONES[appeal.state]} label={t(`m.support.appealState_${appeal.state}`)} />
              <AppText step="secondary" tone="secondary">
                {appeal.body}
              </AppText>
              {appeal.state === 'open' ? (
                <AppText step="caption" tone="muted">
                  {t('m.support.appealDue', { date: formatDate(appeal.dueAt, language) })}
                </AppText>
              ) : null}
              {appeal.reason ? <DetailRow label={t('m.support.reason')} value={appeal.reason} /> : null}
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {open.length > 0 ? (
        <AppealForm key={open.map((decision) => decision.id).join()} caseId={request.id} decisions={open} onSent={reload} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
  entry: { gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
});
