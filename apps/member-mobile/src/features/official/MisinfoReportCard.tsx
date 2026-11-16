import type { MisinfoReport } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
  type Tone,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

// The API's limits on an appeal (AppealIn).
const APPEAL_MIN = 10;
const APPEAL_MAX = 1000;

const APPEAL_TONES: Record<MisinfoReport['appealState'], Tone> = {
  none: 'neutral',
  open: 'pending',
  upheld: 'neutral',
  changed: 'verified',
};

/**
 * One report of a statement: its MR- reference, whether a fact-checker has decided, the outcome
 * with the person's reason, and one appeal against the decision.
 */
export function MisinfoReportCard({ report, onChanged }: { report: MisinfoReport; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [appealing, setAppealing] = useState(false);
  const [body, setBody] = useState('');
  const [showError, setShowError] = useState(false);
  const appeal = useApiAction(async () => {
    await api().appealMisinfoDecision(report.id, body.trim());
    setAppealing(false);
    setBody('');
    onChanged();
  });
  const short = body.trim().length < APPEAL_MIN;
  const decided = report.state === 'decided';

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card" mono>
        {report.reportRef}
      </AppText>
      <StatusTag tone={decided ? 'verified' : 'pending'} label={t(`m.official.state_${report.state}`)} />
      <AppText step="secondary" tone="secondary">
        {report.description}
      </AppText>
      {report.link ? (
        <AppText step="secondary" tone="muted" selectable>
          {report.link}
        </AppText>
      ) : null}
      {report.hasScreenshot ? (
        <AppText step="caption" tone="muted">
          {t('m.official.withScreenshot')}
        </AppText>
      ) : null}
      <AppText step="caption" tone="muted">
        {t('m.official.sentOn', { date: formatDate(report.createdAt, language) })}
      </AppText>

      {decided && report.outcome ? (
        <View style={styles.section}>
          <DetailRow label={t('m.official.outcome')} value={t(`m.official.outcome_${report.outcome}`)} />
          {report.reason ? <DetailRow label={t('m.official.reason')} value={report.reason} /> : null}
          {report.decidedAt ? (
            <AppText step="caption" tone="muted">
              {t('m.official.decidedOn', { date: formatDate(report.decidedAt, language) })}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {report.appealState !== 'none' ? (
        <View style={styles.section}>
          <AppText step="label">{t('m.official.appeal')}</AppText>
          <StatusTag tone={APPEAL_TONES[report.appealState]} label={t(`m.official.appealState_${report.appealState}`)} />
          {report.appealOutcome ? <DetailRow label={t('m.official.outcome')} value={t(`m.official.outcome_${report.appealOutcome}`)} /> : null}
          {report.appealReason ? <DetailRow label={t('m.official.reason')} value={report.appealReason} /> : null}
        </View>
      ) : null}

      {decided && report.appealState === 'none' && !appealing ? (
        <Button label={t('m.official.appealDecision')} variant="secondary" icon="refresh-outline" onPress={() => setAppealing(true)} />
      ) : null}
      {appealing ? (
        <View style={styles.section}>
          <AppText step="secondary" tone="muted">
            {t('m.official.appealExplain')}
          </AppText>
          <TextField
            label={t('m.official.appealLabel')}
            hint={t('m.official.atLeastHint', { min: APPEAL_MIN })}
            value={body}
            multiline
            textAlignVertical="top"
            maxLength={APPEAL_MAX}
            onChangeText={setBody}
            error={showError && short ? t('m.official.atLeast', { min: APPEAL_MIN }) : null}
          />
          {appeal.error ? <Notice tone="error">{errorMessage(t, appeal.error, 'official')}</Notice> : null}
          <Button
            label={t('m.official.sendAppeal')}
            icon="send-outline"
            busy={appeal.busy}
            onPress={() => {
              if (short) {
                setShowError(true);
                return;
              }
              void appeal.run();
            }}
          />
          <Button label={t('m.common.cancel')} variant="quiet" disabled={appeal.busy} onPress={() => setAppealing(false)} />
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  section: { gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
});
