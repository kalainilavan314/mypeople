import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import { AppText, Button, Notice, Screen, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** M04: a deliberate, one-time appeal; authority and eligibility remain server-side. */
export default function AppealScreen() {
  const { t } = useTranslation();
  const [statement, setStatement] = useState('');
  const appeal = useApiAction(async () => {
    await api().appealMyIdentityDecision(statement.trim());
    router.replace('/verify');
  });
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
      <Screen edges={['bottom']}>
        <SurfaceCard accent>
          <AppText step="section" accessibilityRole="header">{t('m.verify.appealTitle')}</AppText>
          <AppText step="body" tone="secondary">{t('m.verify.appealSla')}</AppText>
          <TextField label={t('m.verify.appealReason')} hint={t('m.verify.appealHint')} value={statement} onChangeText={setStatement} multiline maxLength={1000} />
          <AppText step="secondary" tone="muted">{t('m.setup.characters', { count: statement.length, max: 1000 })}</AppText>
          {appeal.error ? <Notice tone="error">{errorMessage(t, appeal.error)}</Notice> : null}
          <Button label={t('m.verify.appealSubmit')} busy={appeal.busy} busyLabel={t('m.common.sending')} disabled={!statement.trim()} onPress={() => void appeal.run()} />
        </SurfaceCard>
      </Screen>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1, gap: spacing[3] } });
