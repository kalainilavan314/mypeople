import type { MfaStatus, TotpEnrolment } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Notice,
  QrCode,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/features/staff/errors';
import { leaveStaffSection } from '@/features/staff/LeaveStaffButton';

type Props = { status: MfaStatus; onVerified: () => void };

/**
 * The staff second factor (NFR-SEC-04, FR-STF-001): set up an authenticator
 * the first time, then give its code in every session. The secret is shown
 * once, only during set-up; the API keeps it encrypted.
 */
export function MfaGate({ status, onVerified }: Props) {
  const { t } = useTranslation();
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const enrolling = !status.enabled;

  const start = useApiAction(async () => {
    setEnrolment(await api().startTotpEnrolment(currentPassword));
    setCurrentPassword('');
  });
  const confirm = useApiAction(async () => {
    if (enrolling) await api().confirmTotp(code.trim());
    else await api().verifyMfa(code.trim());
    setCode('');
    onVerified();
  });
  const failed = start.error ?? confirm.error;

  return (
    <Screen edges={['top', 'bottom']} title={enrolling ? t('s.mfa.enrolTitle') : t('s.mfa.verifyTitle')}>
      <AppText step="body" tone="secondary">
        {enrolling ? t('s.mfa.enrolBody') : t('s.mfa.verifyBody')}
      </AppText>
      {enrolling && !enrolment ? (
        <>
          <TextField
            label={t('s.signIn.passwordLabel')}
            hint={t('s.mfa.passwordStepUp')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secret
            autoComplete="current-password"
          />
          <Button label={t('s.common.continue')} busy={start.busy} disabled={!currentPassword} onPress={() => void start.run()} />
        </>
      ) : null}
      {enrolment ? (
        <SurfaceCard>
          <View style={styles.qr}>
            <QrCode value={enrolment.otpauthUri} size={220} label={t('s.mfa.enrolTitle')} />
          </View>
          <AppText step="label">{t('s.mfa.key')}</AppText>
          <AppText step="body" mono selectable>
            {enrolment.secret}
          </AppText>
        </SurfaceCard>
      ) : null}
      {!enrolling || enrolment ? (
        <>
          <TextField
            label={t('s.mfa.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <Button label={t('s.mfa.confirm')} busy={confirm.busy} disabled={code.trim().length !== 6} onPress={() => void confirm.run()} />
        </>
      ) : null}
      {failed ? <Notice tone="error">{errorMessage(t, failed)}</Notice> : null}
      <Button label={t('s.common.backToApp')} variant="quiet" icon="arrow-back" onPress={leaveStaffSection} />
    </Screen>
  );
}

const styles = StyleSheet.create({ qr: { alignItems: 'center', paddingVertical: spacing[2] } });
