import type { TownHallQuestion } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, StatusTag, useApiAction, useLocalized } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { minutesSeconds, QUESTION_TONES } from './labels';

/**
 * One question: approved ones show the vote total and a vote button (one per member, never one's
 * own); the author also sees the moderation state and the moderator's reason. Answers show as a
 * time in the live session or as written words.
 */
export function QuestionItem({ question, canVote, onChanged }: { question: TownHallQuestion; canVote: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const vote = useApiAction(async () => {
    await api().voteTownHallQuestion(question.id);
    onChanged();
  });
  const written = question.answerMode === 'written' && question.answerEn ? localized(question.answerEn, question.answerTa ?? '') : null;

  return (
    <View style={styles.item}>
      <AppText step="body">{question.body}</AppText>
      <View style={styles.tags}>
        {question.mine ? <StatusTag tone="neutral" label={t('m.townHalls.yourQuestion')} /> : null}
        {question.mine && question.state !== 'approved' ? (
          <StatusTag tone={QUESTION_TONES[question.state]} label={t(`m.townHalls.question_${question.state}`)} />
        ) : null}
      </View>
      {question.mine && question.moderationReason ? (
        <AppText step="secondary" tone="secondary">
          {t('m.townHalls.moderatorReason', { reason: question.moderationReason })}
        </AppText>
      ) : null}
      {question.votes !== null ? (
        <AppText step="secondary" tone="secondary">
          {t('m.townHalls.votes', { votes: question.votes })}
        </AppText>
      ) : null}
      {question.answerMode === 'live' && question.answeredAtSecond !== null ? (
        <AppText step="secondary" tone="success">
          {t('m.townHalls.answeredLive', { time: minutesSeconds(question.answeredAtSecond) })}
        </AppText>
      ) : null}
      {written ? (
        <View style={styles.answer}>
          <AppText step="caption" tone="primary">
            {t('m.townHalls.writtenAnswer')}
          </AppText>
          <AppText step="secondary">{written}</AppText>
        </View>
      ) : null}
      {vote.error ? <Notice tone="error">{errorMessage(t, vote.error, 'townHalls')}</Notice> : null}
      {canVote && question.state === 'approved' && !question.mine ? (
        <Button
          label={question.voted ? t('m.townHalls.voted') : t('m.townHalls.vote')}
          variant="secondary"
          icon={question.voted ? 'checkmark' : 'arrow-up-outline'}
          disabled={question.voted}
          busy={vote.busy}
          accessibilityHint={t('m.townHalls.voteHint')}
          onPress={() => void vote.run()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing[1] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  answer: { gap: 2, paddingLeft: spacing[3], borderLeftWidth: 3, borderLeftColor: colors.border },
});
