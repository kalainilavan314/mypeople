import { api } from '@/core/api';
import { isValidNic } from '@/core/lib/nic';
import { authC, font } from '@/core/theme/tokens';
import {
  AuthPage,
  BackChip,
  Field,
  FieldLabel,
  GreenButton,
  LinkText,
} from '@/features/auth/components/parts';
import { Icon } from '@/shared/components/Icon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Forgot() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [nic, setNic] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const ok = isValidNic(nic);

  const send = async () => {
    setBusy(true);

    await api.requestOtp(nic);
    setBusy(false);
    setSent(true);
  };

  return (
    <AuthPage>
      <div style={{ padding: '18px 20px 6px' }}>
        <BackChip onClick={() => navigate('/login')} />
      </div>

      <div style={{ flex: 1, padding: '10px 24px 28px', display: 'flex', flexDirection: 'column' }}>
        {!sent ? (
          <>
            <h2 style={{ font: `800 26px/1.2 ${font.ta}`, margin: '0 0 7px', color: authC.text }}>
              {t('auth.forgotTitle')}
            </h2>
            <div style={{ font: `400 14px/1.5 ${font.ui}`, color: authC.text2, marginBottom: 24 }}>
              {t('auth.forgotSub')}
            </div>

            <FieldLabel ta={t('auth.nicLabel')} en="NIC number" />
            <Field
              icon="idCard"
              value={nic}
              onChange={(v) => setNic(v.toUpperCase())}
              placeholder="199512345678 / 951234567V"
              autoCapitalize="characters"
              maxLength={12}
              ariaLabel={t('auth.nicLabel')}
            />

            <div style={{ flex: 1, minHeight: 24 }} />
            <GreenButton onClick={send} disabled={!ok} loading={busy}>
              {t('auth.sendReset')}
            </GreenButton>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: authC.greenSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Icon name="check" size={30} color={authC.green} strokeWidth={2.6} />
            </div>
            <h2 style={{ font: `800 22px/1.2 ${font.ta}`, margin: 0, color: authC.text }}>
              {t('auth.resetSentTitle')}
            </h2>
            <div
              style={{
                font: `400 14px/1.6 ${font.ui}`,
                color: authC.text2,
                margin: '10px 0 28px',
                maxWidth: 280,
              }}
            >
              {t('auth.resetSentSub')}
            </div>
            <LinkText onClick={() => navigate('/login')}>{t('auth.backToLogin')}</LinkText>
          </div>
        )}
      </div>
    </AuthPage>
  );
}
