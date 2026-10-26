import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { accountNumber, IdRouteFields, type IdNumber } from '@/features/auth/IdRouteFields';
import { useApiAction } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/providers/SessionProvider';

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
    await start(result.token, result.member);
  });

  const ready = id.number.trim().length > 0 && password.length > 0 && (id.route === 'nic' || id.country.length === 3);

  return (
    <Screen edges={['bottom']}>
      <AppText step="secondary" tone="muted">
        {t('m.signIn.subtitle')}
      </AppText>
      <IdRouteFields value={id} onChange={setId} />
      <TextField
        label={t('m.signIn.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secret
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => ready && void signIn.run()}
      />
      {signIn.error ? <Notice tone="error">{errorMessage(t, signIn.error)}</Notice> : null}
      <Button
        label={t('m.signIn.submit')}
        busy={signIn.busy}
        busyLabel={t('m.common.loading')}
        disabled={!ready}
        onPress={() => void signIn.run()}
      />
      <Button label={t('m.signIn.forgot')} variant="quiet" onPress={() => router.push('/recover')} />
      <Button label={t('m.signIn.noAccount')} variant="quiet" onPress={() => router.replace('/register')} />
    </Screen>
  );
}
