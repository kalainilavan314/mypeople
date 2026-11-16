import type { PromiseFeedbackItem } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { FEEDBACK_MAX, FEEDBACK_MIN } from './labels';

/**
 * Published feedback with the responsible office's replies, and the form for Verified and Active
 * members. Feedback is moderated: the writer's name is never shown and nothing appears before a
 * moderator publishes it.
 */
export function PromiseFeedback({ promiseId, feedback }: { promiseId: string; feedback: PromiseFeedbackItem[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const [body, setBody] = useState('');
  const [showError, setShowError] = useState(false);
  const [sent, setSent] = useState(false);
  const send = useApiAction(async () => {
    await api().givePromiseFeedback(promiseId, body.trim());
    setBody('');
    setShowError(false);
    setSent(true);
  });
  const short = body.trim().length < FEEDBACK_MIN;
  const published = feedback.filter((item) => item.state === 'published');

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.promises.feedback')}
      </AppText>
      {published.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.promises.noFeedback')}
        </AppText>
      ) : (
        published.map((item) => (
          <View key={item.id} style={styles.item}>
            <AppText step="caption" tone="muted">
              {formatDate(item.createdAt, language)}
            </AppText>
            <AppText step="body">{item.body}</AppText>
            {item.replyEn ? (
              <View style={styles.reply}>
                <AppText step="caption" tone="primary">
                  {t('m.promises.officeReply')}
                </AppText>
                <AppText step="secondary">{localized(item.replyEn, item.replyTa ?? '')}</AppText>
              </View>
            ) : null}
          </View>
        ))
      )}

      <View style={styles.form}>
        <AppText step="label">{t('m.promises.giveFeedback')}</AppText>
        <AppText step="secondary" tone="muted">
          {t('m.promises.feedbackModerated')}
        </AppText>
        <TextField
          label={t('m.promises.feedbackLabel')}
          hint={t('m.promises.feedbackHint', { min: FEEDBACK_MIN })}
          value={body}
          multiline
          textAlignVertical="top"
          maxLength={FEEDBACK_MAX}
          onChangeText={(text) => {
            setSent(false);
            setBody(text);
          }}
          error={showError && short ? t('m.promises.feedbackTooShort', { min: FEEDBACK_MIN }) : null}
        />
        {sent ? <Notice tone="success">{t('m.promises.feedbackSent')}</Notice> : null}
        {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'promises')}</Notice> : null}
        <Button
          label={t('m.promises.sendFeedback')}
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
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  item: { gap: 2 },
  reply: { gap: 2, marginTop: spacing[1], paddingLeft: spacing[3], borderLeftWidth: 3, borderLeftColor: colors.border },
  form: { gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
});
