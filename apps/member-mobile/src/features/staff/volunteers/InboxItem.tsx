import type { VolunteerInboxItem } from '@my-people/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, formatDateTime, Notice, StatusTag, SurfaceCard, TextField, useApiAction, useLanguage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { volunteerErrorMessage } from './volunteerErrors';

// The limits the API enforces (AnswerIn).
const ANSWER_MIN = 3;
const ANSWER_MAX = 1000;

/**
 * A volunteer's message or change request, answered through the app (FR-VOL-007, 008). Neither
 * side sees the other's phone number; a change request changes nothing until it is decided.
 */
export function InboxItem({ item, onAnswered }: { item: VolunteerInboxItem; onAnswered: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [answer, setAnswer] = useState('');
  const [showError, setShowError] = useState(false);
  const send = useApiAction(async () => {
    await api().answerVolunteerContact(item.id, answer.trim());
    onAnswered();
  });
  const short = answer.trim().length < ANSWER_MIN;

  return (
    <SurfaceCard>
      <StatusTag
        tone={item.kind === 'change_request' ? 'pending' : 'neutral'}
        label={item.kind === 'change_request' ? t('s.volunteers.changeRequest') : t('s.volunteers.message')}
      />
      <AppText step="card">{item.volunteerName}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {item.offerRef}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {item.opportunityTitleEn}
      </AppText>
      <AppText step="body">{item.body}</AppText>
      <AppText step="caption" tone="muted">
        {formatDateTime(item.createdAt, language)}
      </AppText>
      <TextField
        label={t('s.volunteers.answerLabel')}
        hint={t('s.volunteers.answerHint')}
        value={answer}
        multiline
        textAlignVertical="top"
        maxLength={ANSWER_MAX}
        onChangeText={setAnswer}
        error={showError && short ? t('s.volunteers.answerTooShort', { min: ANSWER_MIN }) : null}
      />
      {send.error ? <Notice tone="error">{volunteerErrorMessage(t, send.error)}</Notice> : null}
      <Button
        label={t('s.volunteers.sendAnswer')}
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
    </SurfaceCard>
  );
}
