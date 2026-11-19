import Ionicons from '@expo/vector-icons/Ionicons';
import type { AssistantMessage, AssistantRating } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, ChipRow, Notice, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { ReadAloudButton } from '@/features/voice/ReadAloudButton';
import type { VoiceLanguage } from '@/features/voice/voiceTypes';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { Citations } from './Citations';
import { NOTE_MAX, NOTE_MIN } from './labels';

/**
 * One answer: the AI explanation (labelled as AI), the official text and sources it cites, what the
 * assistant would not do and why, and the member's rating, error report and way to a person
 * (FR-AIA-003, 004, 005, 007, 008).
 */
export function AnswerCard({
  message,
  language,
  onChanged,
  onTalkToPerson,
}: {
  message: AssistantMessage;
  language: VoiceLanguage;
  onChanged: (message: AssistantMessage) => void;
  onTalkToPerson: () => void;
}) {
  const { t } = useTranslation();
  const answered = message.outcome === 'answered';

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="sparkles-outline" size={iconSize.chevron} color={colors.primary} style={styles.noShrink} />
        <AppText step="label" tone="primary" style={styles.flex}>
          {t('m.assistant.aiExplanation')}
        </AppText>
      </View>
      {!answered && message.outcome ? (
        <AppText step="secondary" tone="secondary">
          {t(`m.assistant.outcome_${message.outcome}`)}
        </AppText>
      ) : null}
      <AppText step="body">{message.body}</AppText>
      {message.refusal ? <Notice tone="info">{t(`m.assistant.refusal_${message.refusal}`)}</Notice> : null}
      <Citations citations={message.citations} />
      {message.topics.includes('eligibility') ? (
        <Button label={t('m.assistant.askSupport')} icon="people-outline" variant="secondary" onPress={() => router.push('/support')} />
      ) : null}
      {message.topics.includes('election') ? (
        <AppText step="secondary" tone="secondary">
          {t('m.assistant.electionNote')}
        </AppText>
      ) : null}
      <ReadAloudButton text={message.body} language={language} />
      {answered ? <Rating message={message} onChanged={onChanged} /> : null}
      {message.outcome !== 'failed' ? <ReportError message={message} onChanged={onChanged} /> : null}
      <Button label={t('m.assistant.talkToPerson')} icon="chatbubble-outline" variant="quiet" onPress={onTalkToPerson} />
    </SurfaceCard>
  );
}

function Rating({ message, onChanged }: { message: AssistantMessage; onChanged: (message: AssistantMessage) => void }) {
  const { t } = useTranslation();
  const rate = useApiAction(async (rating: AssistantRating | null) => {
    onChanged(await api().rateAssistantAnswer(message.id, rating));
  });
  return (
    <View style={styles.section}>
      <AppText step="secondary" tone="secondary">
        {t('m.assistant.rateLabel')}
      </AppText>
      <ChipRow
        label={t('m.assistant.rateLabel')}
        selected={message.rating}
        onSelect={(rating) => {
          if (!rate.busy) void rate.run(rating === message.rating ? null : rating);
        }}
        options={[
          { key: 'helpful', label: t('m.assistant.helpful') },
          { key: 'not_helpful', label: t('m.assistant.notHelpful') },
        ]}
      />
      {message.rating && !rate.error ? (
        <AppText step="caption" tone="muted" accessibilityLiveRegion="polite">
          {t('m.assistant.rated')}
        </AppText>
      ) : null}
      {rate.error ? <Notice tone="error">{errorMessage(t, rate.error, 'assistant')}</Notice> : null}
    </View>
  );
}

function ReportError({ message, onChanged }: { message: AssistantMessage; onChanged: (message: AssistantMessage) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);
  const send = useApiAction(async () => {
    await api().reportAssistantError(message.id, note.trim());
    onChanged({ ...message, reported: true });
    setOpen(false);
  });

  if (message.reported) {
    return (
      <View style={styles.reported}>
        <Ionicons name="checkmark-circle-outline" size={iconSize.chevron} color={colors.primary} style={styles.noShrink} />
        <AppText step="secondary" tone="secondary" style={styles.flex}>
          {`${t('m.assistant.reported')}. ${t('m.assistant.reportSent')}`}
        </AppText>
      </View>
    );
  }
  if (!open) {
    return <Button label={t('m.assistant.reportError')} icon="alert-circle-outline" variant="quiet" onPress={() => setOpen(true)} />;
  }
  const short = note.trim().length < NOTE_MIN;
  return (
    <View style={styles.section}>
      <TextField
        label={t('m.assistant.reportLabel')}
        hint={t('m.assistant.reportHint')}
        value={note}
        multiline
        textAlignVertical="top"
        maxLength={NOTE_MAX}
        onChangeText={setNote}
        error={showError && short ? t('m.assistant.reportTooShort') : null}
      />
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'assistant')}</Notice> : null}
      <Button
        label={t('m.assistant.sendReport')}
        icon="send-outline"
        busy={send.busy}
        onPress={() => {
          if (short) {
            setShowError(true);
            return;
          }
          void send.run();
        }}
      />
      <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  noShrink: { flexShrink: 0 },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
  reported: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
