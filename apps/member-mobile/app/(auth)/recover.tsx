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

type Stage = 'request' | 'code' | 'password' | 'done';

/**
 * A13: a code to the confirmed recovery number, then a new password. The
 * answer is the same whether or not the number is registered (FR-AUTH-014).
 */
export default function RecoverScreen() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('request');
  const [id, setId] = useState<IdNumber>({ route: 'nic', number: '', country: '' });
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');

  const request = useApiAction(async () => {
    await api().requestRecovery(accountNumber(id));
    setStage('code');
  });
  const verify = useApiAction(async () => {
    const result = await api().verifyRecovery(accountNumber(id), code.trim());
    setResetToken(result.resetToken);
    setStage('password');
  });
  const reset = useApiAction(async () => {
    await api().resetPassword(resetToken, password);
    setStage('done');
  });
  const failed = request.error ?? verify.error ?? reset.error;

  return (
    <Screen edges={['bottom']}>
      <AppText step="secondary" tone="muted">
        {t('m.recover.subtitle')}
      </AppText>

      {stage === 'request' ? (
        <>
          <IdRouteFields value={id} onChange={setId} />
          <Button
            label={t('m.recover.send')}
            busy={request.busy}
            busyLabel={t('m.common.sending')}
            disabled={id.number.trim() === '' || (id.route === 'passport' && id.country.length !== 3)}
            onPress={() => void request.run()}
          />
        </>
      ) : null}

      {stage === 'code' ? (
        <>
          <Notice tone="info">{t('m.recover.sent')}</Notice>
          <TextField
            label={t('m.recover.codeLabel')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <Button
            label={t('m.recover.verify')}
            busy={verify.busy}
            disabled={code.trim().length < 4}
            onPress={() => void verify.run()}
          />
        </>
      ) : null}

      {stage === 'password' ? (
        <>
          <TextField
            label={t('m.recover.newPassword')}
            hint={t('m.register.passwordHint')}
            value={password}
            onChangeText={setPassword}
            secret
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Button
            label={t('m.recover.reset')}
            busy={reset.busy}
            busyLabel={t('m.common.saving')}
            disabled={password.length < 10}
            onPress={() => void reset.run()}
          />
        </>
      ) : null}

      {stage === 'done' ? (
        <>
          <Notice tone="success">{t('m.recover.done')}</Notice>
          <Button label={t('m.signIn.submit')} onPress={() => router.replace('/sign-in')} />
        </>
      ) : null}

      {failed ? <Notice tone="error">{errorMessage(t, failed)}</Notice> : null}

      {stage !== 'done' ? (
        <Button label={t('m.recover.noNumber')} variant="quiet" onPress={() => router.push('/assisted-recovery')} />
      ) : null}
    </Screen>
  );
}
