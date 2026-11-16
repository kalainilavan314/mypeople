import { ApiError, type SurveyDetail } from '@my-people/api-client';
import { router } from 'expo-router';
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
  useApiAction,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FieldError } from '@/components/FieldError';
import { ProgressBar } from '@/components/ProgressBar';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { answersToSend, answerWords, initialAnswers, isAnswered, orderedQuestions, refusedQuestion, type Answers } from './answers';
import { QuestionInput } from './QuestionInput';

// The steps: the privacy statement first, then one question per screen, then the review.
const INTRO = -1;

/**
 * H14 Answer a survey: who it is for and how the answers are used come first (FR-SRV-002), then
 * one question per screen with its number and a progress bar. Back keeps every answer; required
 * questions must be answered to go on; everything is reviewed before Send.
 */
export function SurveyForm({ survey }: { survey: SurveyDetail }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const questions = orderedQuestions(survey);
  const reviewStep = questions.length;
  const [step, setStep] = useState(INTRO);
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(survey));
  const [missing, setMissing] = useState(false);
  const send = useApiAction(async () => {
    await api().submitSurveyResponse(survey.id, answersToSend(questions, answers));
    router.replace({ pathname: '/surveys/[id]/done', params: { id: survey.id } });
  });

  const go = (next: number) => {
    setMissing(false);
    setStep(next);
  };

  if (step === INTRO) return <SurveyIntro survey={survey} onStart={() => go(0)} />;

  if (step >= reviewStep) {
    const refused = send.error instanceof ApiError ? refusedQuestion(send.error.problems) : null;
    return (
      <View style={styles.body}>
        <AppText step="section" accessibilityRole="header">
          {t('m.surveys.reviewTitle')}
        </AppText>
        <AppText step="body" tone="secondary">
          {t('m.surveys.reviewIntro')}
        </AppText>
        <SurfaceCard style={styles.reviewList}>
          {questions.map((question, index) => (
            <View key={question.id} style={[styles.reviewItem, index > 0 && styles.divider]}>
              <AppText step="caption" tone="muted">
                {t('m.surveys.questionOf', { number: index + 1, total: questions.length })}
              </AppText>
              <DetailRow
                label={localized(question.promptEn, question.promptTa)}
                value={answerWords(question, answers[question.id], localized, t)}
              />
              <Button label={t('m.surveys.change')} variant="quiet" icon="create-outline" disabled={send.busy} onPress={() => go(index)} />
            </View>
          ))}
        </SurfaceCard>
        {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'surveys')}</Notice> : null}
        {refused !== null && refused <= questions.length ? (
          <Button
            label={t('m.surveys.goToQuestion', { number: refused })}
            variant="secondary"
            onPress={() => go(refused - 1)}
          />
        ) : null}
        <Button label={t('m.surveys.send')} icon="send-outline" busy={send.busy} onPress={() => void send.run()} />
        <Button label={t('m.common.back')} variant="secondary" icon="arrow-back" disabled={send.busy} onPress={() => go(reviewStep - 1)} />
      </View>
    );
  }

  const question = questions[step];
  if (!question) return null;
  const prompt = localized(question.promptEn, question.promptTa);
  const position = t('m.surveys.questionOf', { number: step + 1, total: questions.length });
  const next = () => {
    if (question.required && !isAnswered(answers[question.id])) {
      setMissing(true);
      return;
    }
    go(step + 1);
  };

  return (
    <View style={styles.body}>
      <AppText step="secondary" tone="muted" accessibilityLiveRegion="polite">
        {position}
      </AppText>
      <ProgressBar done={step + 1} total={questions.length} label={position} />
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {prompt}
        </AppText>
        <AppText step="caption" tone="muted">
          {question.required ? t('m.surveys.required') : t('m.surveys.optional')}
        </AppText>
        <QuestionInput
          key={question.id}
          question={question}
          label={prompt}
          value={answers[question.id]}
          onChange={(value) => {
            setMissing(false);
            setAnswers((current) => {
              const nextAnswers = { ...current };
              if (value === undefined) delete nextAnswers[question.id];
              else nextAnswers[question.id] = value;
              return nextAnswers;
            });
          }}
        />
        {missing ? <FieldError text={t('m.surveys.answerRequired')} /> : null}
      </SurfaceCard>
      <Button
        label={step + 1 === questions.length ? t('m.surveys.reviewAnswers') : t('m.surveys.next')}
        icon="arrow-forward"
        iconAfter
        onPress={next}
      />
      <Button label={t('m.common.back')} variant="secondary" icon="arrow-back" onPress={() => go(step - 1)} />
    </View>
  );
}

/** Who the survey is for, how answers are used, and when it closes; before any question. */
function SurveyIntro({ survey, onStart }: { survey: SurveyDetail; onStart: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  return (
    <View style={styles.body}>
      <AppText step="page" accessibilityRole="header">
        {localized(survey.titleEn, survey.titleTa)}
      </AppText>
      {survey.anonymous ? <StatusTag tone="neutral" label={t('m.surveys.anonymous')} /> : null}
      <SurfaceCard style={styles.card}>
        <DetailRow label={t('m.surveys.audience')} value={localized(survey.audienceEn, survey.audienceTa)} />
        <DetailRow label={t('m.surveys.privacy')} value={localized(survey.privacyEn, survey.privacyTa)} />
        <DetailRow label={t('m.surveys.questionCount')} value={String(survey.questions.length)} />
        {survey.closesAt ? (
          <DetailRow label={t('m.surveys.closes')} value={formatDate(survey.closesAt, language)} />
        ) : null}
      </SurfaceCard>
      {survey.receipt ? (
        <Notice tone="info">
          {t('m.surveys.changingAnswers', { date: formatDate(survey.receipt.updatedAt, language) })}
        </Notice>
      ) : null}
      <Button label={survey.receipt ? t('m.surveys.changeAnswers') : t('m.surveys.start')} icon="arrow-forward" iconAfter onPress={onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
  reviewList: { padding: 0, gap: 0, overflow: 'hidden' },
  reviewItem: { gap: spacing[1], padding: spacing[4] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
