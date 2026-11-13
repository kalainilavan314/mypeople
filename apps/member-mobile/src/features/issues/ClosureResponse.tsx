import type { MyIssueReport } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  formatDate,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  type Tone,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { issueErrorMessage } from './issueErrors';
import { LIMITS } from './labels';
import { StarRating } from './StarRating';

type Answer = 'resolved' | 'not_resolved';

const RESPONSE_TONES: Record<string, Tone> = {
  recorded: 'verified',
  challenge_open: 'pending',
  challenge_accepted: 'verified',
  challenge_rejected: 'error',
};

type Props = { issueId: string; report: MyIssueReport; onAnswered: () => void };

/**
 * FR-RPT-016: after closure the reporter rates it, or challenges it with a note, within the
 * window the server gives; afterwards the answer and the team's decision on a challenge show here.
 */
export function ClosureResponse({ issueId, report, onAnswered }: Props) {
  if (report.response) return <ResponseState response={report.response} />;
  if (!report.canRespond) return null;
  return <ResponseForm issueId={issueId} until={report.challengeUntil} onAnswered={onAnswered} />;
}

function ResponseState({ response }: { response: NonNullable<MyIssueReport['response']> }) {
  const { t } = useTranslation();
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.issues.answer')}
      </AppText>
      <StatusTag
        tone={RESPONSE_TONES[response.state] ?? 'neutral'}
        label={t(`m.issues.response_${response.state}`, { defaultValue: response.state.replace(/_/g, ' ') })}
      />
      {response.rating ? (
        <AppText step="secondary" tone="secondary">
          {t('m.issues.yourRating', { count: response.rating })}
        </AppText>
      ) : null}
      {response.decisionReason ? (
        <AppText step="body" tone="secondary">
          {t('m.issues.reason', { reason: response.decisionReason })}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

function ResponseForm({ issueId, until, onAnswered }: { issueId: string; until: string | null; onAnswered: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [rating, setRating] = useState<number | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const challenge = answer === 'not_resolved';
  const noteLength = note.trim().length;
  const noteInvalid = challenge && (noteLength < LIMITS.noteMin || noteLength > LIMITS.noteMax);

  const send = useApiAction(async () => {
    if (answer === null || noteInvalid) {
      setShowErrors(true);
      return;
    }
    await api().respondToIssueClosure(issueId, { resolved: !challenge, rating, note: challenge ? note.trim() : null });
    onAnswered();
  });

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.issues.rateTitle')}
      </AppText>
      {until ? (
        <AppText step="secondary" tone="muted">
          {t('m.issues.rateUntil', { date: formatDate(until, language) })}
        </AppText>
      ) : null}

      <View style={styles.field}>
        <AppText step="body" tone="secondary">
          {`${t('m.issues.rating')}  `}
          <AppText step="secondary" tone="muted">
            {t('m.issues.ratingHint')}
          </AppText>
        </AppText>
        <StarRating value={rating} onChange={setRating} label={t('m.issues.rating')} />
      </View>

      <View style={styles.field}>
        <AppText step="body" tone="secondary">
          {t('m.issues.answer')}
        </AppText>
        <ChipRow
          label={t('m.issues.answer')}
          selected={answer}
          onSelect={setAnswer}
          options={[
            { key: 'resolved', label: t('m.issues.resolvedYes') },
            { key: 'not_resolved', label: t('m.issues.resolvedNo') },
          ]}
        />
        {showErrors && answer === null ? (
          <AppText step="secondary" tone="error" accessibilityRole="alert">
            {t('m.issues.answerError')}
          </AppText>
        ) : null}
      </View>

      {challenge ? (
        <TextField
          label={t('m.issues.noteLabel')}
          hint={t('m.issues.noteHint')}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.noteMax}
          error={showErrors && noteInvalid ? t('m.issues.noteError') : null}
        />
      ) : null}

      {send.error ? <Notice tone="error">{issueErrorMessage(t, send.error)}</Notice> : null}
      <Button label={t('m.issues.sendAnswer')} busy={send.busy} busyLabel={t('m.common.sending')} onPress={() => void send.run()} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  field: { gap: spacing[2] },
});
