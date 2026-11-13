import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import { AppText, Button, Notice, Screen, TextField, useApiAction, useSession } from '@my-people/mobile-ui';

import { accountNumber, IdRouteFields, type IdNumber } from '@/features/auth/IdRouteFields';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** A02: sign in with the NIC, or a passport number and country, and a password. One generic error (FR-AUTH-013). */
export default function SignInScreen() {
  const { t } = useTranslation();
  const { start } = useSession();
  const [id, setId] = useState<IdNumber>({ route: 'nic', number: '', country: '' });
  const [password, setPassword] = useState('');
  const signIn = useApiAction(async () => {
    const account = accountNumber(id);
    const result =
      'nic' in account
        ? await api().signIn(account.nic, password)
        : await api().signInWithPassport(account.passportNumber, account.passportCountry, password);
    await start(result);
  });

  const ready = id.number.trim().length > 0 && password.length > 0 && (id.route === 'nic' || id.country.length === 3);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
      <Screen
        title={t('m.signIn.title')}
        subtitle={t('m.signIn.subtitle')}
        edges={['bottom']}
        maxContentWidth={560}>
        <View style={styles.form}>
          <IdRouteFields value={id} onChange={setId} />
          <TextField
            label={t('m.signIn.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            secret
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => ready && void signIn.run()}
          />
        </View>
        {signIn.error ? <Notice tone="error">{errorMessage(t, signIn.error)}</Notice> : null}
        <View style={styles.actions}>
          <Button
            label={t('m.signIn.submit')}
            busy={signIn.busy}
            busyLabel={t('m.common.loading')}
            disabled={!ready}
            onPress={() => void signIn.run()}
          />
          <Button label={t('m.signIn.forgot')} variant="quiet" onPress={() => router.push('/recover')} />
        </View>
        <View style={styles.accountAction}>
          <AppText step="secondary" tone="muted" style={styles.accountPrompt}>
            {t('m.signIn.newAccountPrompt')}
          </AppText>
          <Button label={t('m.welcome.createAccount')} variant="secondary" onPress={() => router.replace('/register')} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: spacing[4] },
  actions: { gap: spacing[2] },
  accountAction: { gap: spacing[2], marginTop: spacing[2] },
  accountPrompt: { textAlign: 'center' },
});
