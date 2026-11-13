import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, TextField, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { QUESTION_MAX, QUESTION_MIN } from './labels';

/** M22 Ask a question: others see it only after a moderator approves it (FR-THL-004). */
export function AskQuestion({ townHallId, onAsked }: { townHallId: string; onAsked: () => void }) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [showError, setShowError] = useState(false);
  const [sent, setSent] = useState(false);
  const ask = useApiAction(async () => {
    await api().askTownHallQuestion(townHallId, body.trim());
    setBody('');
    setShowError(false);
    setSent(true);
    onAsked();
  });
  const short = body.trim().length < QUESTION_MIN;

  return (
    <View style={styles.form}>
      <AppText step="secondary" tone="muted">
        {t('m.townHalls.askModerated')}
      </AppText>
      <TextField
        label={t('m.townHalls.questionLabel')}
        hint={t('m.townHalls.questionHint', { min: QUESTION_MIN, max: QUESTION_MAX })}
        value={body}
        multiline
        textAlignVertical="top"
        maxLength={QUESTION_MAX}
        onChangeText={(text) => {
          setSent(false);
          setBody(text);
        }}
        error={showError && short ? t('m.townHalls.questionTooShort', { min: QUESTION_MIN }) : null}
      />
      {sent ? <Notice tone="success">{t('m.townHalls.questionSent')}</Notice> : null}
      {ask.error ? <Notice tone="error">{errorMessage(t, ask.error, 'townHalls')}</Notice> : null}
      <Button
        label={t('m.townHalls.ask')}
        icon="send-outline"
        busy={ask.busy}
        onPress={() => {
          if (short) {
            setShowError(true);
            return;
          }
          void ask.run();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing[2] } });
