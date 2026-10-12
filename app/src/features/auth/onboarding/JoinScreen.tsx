import { api } from '@/core/api';
import { c, font, radius } from '@/core/theme/tokens';
import { PalmyraMark } from '@/features/card/components/PalmyraMark';
import { Button } from '@/shared/components/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Join() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const valid = phone.replace(/\D/g, '').length >= 9;

  const send = async () => {
    setSending(true);
    const full = phone.startsWith('+') ? phone : `+94${phone.replace(/^0/, '')}`;
    await api.requestOtp(full);
    setSending(false);
    navigate('/welcome/otp', { state: { phone: full } });
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: c.maroon,
          color: '#FFFFFF',
          padding: '48px 24px 40px',
          borderRadius: '0 0 30px 30px',
        }}
      >
        <PalmyraMark size={260} style={{ position: 'absolute', right: -70, top: -50 }} />
        <PalmyraMark
          size={120}
          stroke="#FFFFFF"
          opacity={0.08}
          style={{ position: 'absolute', left: -30, bottom: -30 }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{
              font: `500 13px/1 ${font.ui}`,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.8)',
            }}
          >
            MY PEOPLE
          </div>
          <h1 style={{ font: `700 28px/1.35 ${font.ta}`, margin: '14px 0 6px' }}>
            {t('onboarding.joinTitle')}
          </h1>
          <div style={{ font: `400 14px/1.5 ${font.ui}`, color: 'rgba(255,246,236,.75)' }}>
            {t('onboarding.joinSubtitle')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '28px 24px' }}>
        <label style={{ font: `600 13px/1 ${font.ta}`, color: c.ink2 }}>
          {t('onboarding.phoneLabel')}
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            height: 56,
            padding: '0 16px',
            borderRadius: radius.md,
            border: `1.5px solid ${c.hairline}`,
            background: c.card,
          }}
        >
          <span style={{ font: `600 15px/1 ${font.mono}`, color: c.ink2 }}>+94</span>
          <span style={{ width: 1, height: 24, background: c.hairline }} />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="77 123 4567"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: `500 16px/1 ${font.mono}`,
              color: c.ink,
            }}
          />
        </div>
        <div style={{ font: `400 12px/1.5 ${font.ui}`, color: c.ink3, marginTop: 10 }}>
          {t('onboarding.phoneHint')}
        </div>

        <div style={{ marginTop: 28 }}>
          <Button fullWidth disabled={!valid || sending} onClick={send}>
            {sending ? t('common.loading') : t('onboarding.sendCode')}
          </Button>
        </div>
      </div>
    </div>
  );
}
