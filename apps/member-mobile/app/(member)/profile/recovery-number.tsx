import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * The recovery number (FR-REG-028): recovery codes only ever go to a number
 * the member confirmed with a code. Changing it tells the old number.
 */
export default function RecoveryNumberScreen() {
  const { t } = useTranslation();
  const current = useApiQuery(() => api().getMyRecoveryPhone());
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const send = useApiAction(async () => {
    const result = await api().requestPhoneConfirmation(phone.trim());
    setSentTo(phone.trim());
    setDevCode(result.devCode ?? null);
  });
  const confirm = useApiAction(async () => {
    if (!sentTo) return;
    await api().confirmPhone(sentTo, code.trim(), currentPassword || undefined);
    setConfirmed(true);
    setSentTo(null);
    setCode('');
    setCurrentPassword('');
    current.reload();
  });
  const failed = send.error ?? confirm.error;
  const replacing = current.data !== null && current.data !== undefined;

  return (
    <Screen edges={['bottom']}>
      <QueryView query={current}>
        {(data) =>
          data ? (
            <SurfaceCard>
              <AppText step="label">{t('m.profile.recoveryNumber')}</AppText>
              <AppText step="body" mono>
                {data.phone}
              </AppText>
            </SurfaceCard>
          ) : null
        }
      </QueryView>
      {confirmed ? <Notice tone="success">{t('m.profile.numberConfirmed')}</Notice> : null}
      <TextField
        label={t('m.profile.phoneLabel')}
        hint={t('m.errors.invalid_phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Button label={t('m.profile.sendCode')} busy={send.busy} busyLabel={t('m.common.sending')} disabled={current.data === undefined || phone.trim().length < 9} onPress={() => void send.run()} />
      {sentTo ? (
        <>
          {devCode ? <Notice tone="info">{t('m.profile.devCode', { code: devCode })}</Notice> : null}
          <TextField
            label={t('m.recover.codeLabel')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          {replacing ? (
            <TextField
              label={t('m.profile.currentPassword')}
              hint={t('m.profile.recoveryChangePasswordHint')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secret
              autoComplete="current-password"
            />
          ) : null}
          <Button label={t('m.profile.confirmNumber')} busy={confirm.busy} disabled={!/^\d{6}$/.test(code.trim()) || (replacing && !currentPassword)} onPress={() => void confirm.run()} />
        </>
      ) : null}
      {failed ? <Notice tone="error">{errorMessage(t, failed)}</Notice> : null}
    </Screen>
  );
}
