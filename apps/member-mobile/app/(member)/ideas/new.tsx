import type { Idea } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, Screen, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ModerationNotice } from '@/features/ideas/ModerationNotice';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

// The limits the API enforces (IdeaIn).
const TITLE_MIN = 5;
const TITLE_MAX = 80;
const BENEFIT_MIN = 10;
const BENEFIT_MAX = 1000;

/**
 * H13 Share an idea: a short title and the local benefit, a review before sending, then the
 * receipt. A moderator reads it before anyone else sees it (FR-IDEA-002, 003).
 */
export default function NewIdeaScreen() {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [benefit, setBenefit] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [receipt, setReceipt] = useState<Idea | null>(null);
  const submit = useApiAction(async () => {
    setReceipt(await api().submitIdea({ title: title.trim(), benefit: benefit.trim() }));
  });

  const titleShort = title.trim().length < TITLE_MIN;
  const titleLong = title.trim().length > TITLE_MAX;
  const benefitShort = benefit.trim().length < BENEFIT_MIN;

  if (receipt) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <ReceiptCard
          title={t('m.ideas.receiptTitle')}
          referenceLabel={t('m.ideas.reference')}
          reference={receipt.ideaRef}
          body={t('m.ideas.receiptBody')}>
          <Button
            label={t('m.ideas.viewMyIdeas')}
            icon="list-outline"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/ideas'))}
          />
        </ReceiptCard>
      </Screen>
    );
  }

  const review = () => {
    if (titleShort || titleLong || benefitShort) {
      setShowErrors(true);
      return;
    }
    submit.clearError();
    setReviewing(true);
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      {reviewing ? (
        <View style={styles.form}>
          <AppText step="body" tone="secondary">
            {t('m.ideas.reviewIntro')}
          </AppText>
          <SurfaceCard style={styles.card}>
            <DetailRow label={t('m.ideas.titleLabel')} value={title.trim()} />
            <DetailRow label={t('m.ideas.benefitLabel')} value={benefit.trim()} />
          </SurfaceCard>
          <ModerationNotice />
          {submit.error ? <Notice tone="error">{errorMessage(t, submit.error, 'ideas')}</Notice> : null}
          <Button label={t('m.ideas.send')} icon="send-outline" busy={submit.busy} onPress={() => void submit.run()} />
          <Button
            label={t('m.ideas.edit')}
            variant="secondary"
            icon="create-outline"
            disabled={submit.busy}
            onPress={() => setReviewing(false)}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <AppText step="body" tone="secondary">
            {t('m.ideas.formIntro')}
          </AppText>
          <SurfaceCard style={styles.card}>
            <TextField
              label={t('m.ideas.titleLabel')}
              hint={t('m.ideas.titleCount', { count: title.trim().length, max: TITLE_MAX })}
              value={title}
              maxLength={TITLE_MAX}
              onChangeText={setTitle}
              error={
                showErrors && titleShort
                  ? t('m.ideas.titleTooShort', { min: TITLE_MIN })
                  : titleLong
                    ? t('m.ideas.titleTooLong', { max: TITLE_MAX })
                    : null
              }
            />
            <TextField
              label={t('m.ideas.benefitLabel')}
              hint={t('m.ideas.benefitHint', { min: BENEFIT_MIN })}
              value={benefit}
              multiline
              textAlignVertical="top"
              maxLength={BENEFIT_MAX}
              onChangeText={setBenefit}
              error={showErrors && benefitShort ? t('m.ideas.benefitTooShort', { min: BENEFIT_MIN }) : null}
            />
          </SurfaceCard>
          <ModerationNotice />
          <Button label={t('m.ideas.reviewIdea')} icon="arrow-forward" iconAfter onPress={review} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  card: { gap: spacing[3] },
});
