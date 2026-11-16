import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice, Screen, TextField, useApiAction } from '@my-people/mobile-ui';

import { accountNumber, IdRouteFields, type IdNumber } from '@/features/auth/IdRouteFields';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Stage = 'request' | 'code' | 'password' | 'done';

/**
 * A16: a code to the confirmed recovery number, then a new password. The
 * answer is the same whether or not the number is registered (FR-AUTH-014).
 */
export default function RecoverScreen() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('request');
  const [id, setId] = useState<IdNumber>({ route: 'nic', number: '', country: '' });
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');

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
  const restart = () => {
    setStage('request');
    setCode('');
    setResetToken('');
    setPassword('');
    setPasswordAgain('');
    request.clearError();
    verify.clearError();
    reset.clearError();
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={560}>
      <AppText step="secondary" tone="muted">
        {t('m.recover.subtitle')}
      </AppText>

      {stage === 'request' ? (
        <>
          <AppText step="section" accessibilityRole="header">{t('m.recover.identifyAccount')}</AppText>
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
          <AppText step="section" accessibilityRole="header">{t('m.recover.enterCode')}</AppText>
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
            disabled={!/^\d{6}$/.test(code.trim())}
            onPress={() => void verify.run()}
          />
          <Button label={t('m.recover.changeAccount')} variant="quiet" onPress={restart} />
        </>
      ) : null}

      {stage === 'password' ? (
        <>
          <AppText step="section" accessibilityRole="header">{t('m.recover.choosePassword')}</AppText>
          <TextField
            label={t('m.recover.newPassword')}
            hint={t('m.register.passwordHint')}
            value={password}
            onChangeText={setPassword}
            secret
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            label={t('m.recover.confirmPassword')}
            value={passwordAgain}
            onChangeText={setPasswordAgain}
            secret
            autoComplete="new-password"
            textContentType="newPassword"
            error={passwordAgain !== '' && passwordAgain !== password ? t('m.recover.passwordMismatch') : null}
          />
          <Button
            label={t('m.recover.reset')}
            busy={reset.busy}
            busyLabel={t('m.common.saving')}
            disabled={password.length < 10 || passwordAgain !== password}
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
