import type { IdentityReview } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, Screen, SurfaceCard, TextField, useApiAction, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** M04: show the decision being appealed before asking for the member's words. */
export default function AppealScreen() {
  const { t } = useTranslation();
  const eligibility = useApiQuery(async () => {
    const [review, features] = await Promise.all([api().getMyIdentityReview(), api().getEnabledFeatures()]);
    return { review, enabled: features.enabled.includes('identity_appeals') };
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
      <Screen edges={['bottom']} title={t('m.verify.appealTitle')} onRefresh={eligibility.reload}>
        <QueryView query={eligibility}>{({ review, enabled }) => (
          <AppealContent key={review?.reviewRef ?? 'none'} review={review} enabled={enabled} />
        )}</QueryView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function AppealContent({ review, enabled }: { review: IdentityReview | null; enabled: boolean }) {
  const { t } = useTranslation();
  const [statement, setStatement] = useState('');
  const latest = review?.history[0]; // API history is newest first.
  const eligible = enabled && review?.state === 'unable_to_verify' && latest?.decision === 'unable_to_verify' && !latest.appeal;
  const appeal = useApiAction(async () => {
    await api().appealMyIdentityDecision(statement.trim());
    router.replace('/verify');
  });

  if (!eligible || !latest) {
    return (
      <SurfaceCard>
        <Notice tone="info">{t(enabled ? 'm.verify.appealUnavailable' : 'm.verify.appealClosed')}</Notice>
        <Button label={t('m.common.back')} variant="secondary" onPress={() => router.replace('/verify')} />
      </SurfaceCard>
    );
  }

  return (
    <View style={styles.content}>
      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">{t('m.verify.appealDecision')}</AppText>
        <AppText step="body">{t('m.verify.status_unable_to_verify')}</AppText>
        {latest.reasonCategory ? (
          <AppText step="secondary" tone="secondary">
            {t(`m.verify.reason_${latest.reasonCategory}`, { defaultValue: t('m.verify.reason_other') })}
          </AppText>
        ) : null}
        {latest.note ? <AppText step="secondary" tone="secondary">{latest.note}</AppText> : null}
        {latest.requestedItems.map((item) => (
          <AppText key={item} step="secondary" tone="secondary">
            {t(`m.verify.item_${item}`, { defaultValue: item })}
          </AppText>
        ))}
      </SurfaceCard>

      <SurfaceCard accent>
        <AppText step="body" tone="secondary">{t('m.verify.appealSla')}</AppText>
        <TextField
          label={t('m.verify.appealReason')}
          hint={t('m.verify.appealHint')}
          value={statement}
          onChangeText={setStatement}
          multiline
          maxLength={1000}
        />
        <AppText step="secondary" tone="muted">{t('m.setup.characters', { count: statement.length, max: 1000 })}</AppText>
        {appeal.error ? <Notice tone="error">{errorMessage(t, appeal.error)}</Notice> : null}
        <Button
          label={t('m.verify.appealSubmit')}
          busy={appeal.busy}
          busyLabel={t('m.common.sending')}
          disabled={!statement.trim()}
          onPress={() => void appeal.run()}
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing[3] },
});
