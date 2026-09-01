import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius, ease } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/ui';
import { api } from '../../data';

export function Otp() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { phone?: string } };
  const { t } = useTranslation();
  const phone = state?.phone ?? '+94 77 ••• ••••';
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const full = otp.length >= 6;

  const push = (d: string) => setOtp((v) => (v + d).slice(0, 6));
  const del = () => setOtp((v) => v.slice(0, -1));

  const verify = async () => {
    setVerifying(true);
    const res = await api.verifyOtp(phone, otp);
    setVerifying(false);
    if (res.ok) navigate('/welcome/nic');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <ScreenHeader titleTa={t('onboarding.otpTitle')} titleEn="Verify" onBack={() => navigate('/welcome')} />
      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ font: `400 14px/1.5 ${font.ui}`, color: c.ink2 }}>{t('onboarding.otpSubtitle', { phone })}</div>

        {/* OTP boxes */}
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const active = otp.length === i;
            return (
              <div key={i} style={{ flex: 1, height: 58, borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.card, font: `600 24px/1 ${font.mono}`, color: c.ink, border: `2px solid ${active ? c.maroon : otp[i] ? c.hairline2 : c.hairline}`, boxShadow: active ? `0 0 0 4px ${c.maroonTint}` : 'none', transition: `all 160ms ${ease}` }}>
                {otp[i] ?? ''}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Key key={d} label={d} onClick={() => push(d)} />
          ))}
          <span />
          <Key label="0" onClick={() => push('0')} />
          <Key label="⌫" onClick={del} muted />
        </div>

        <Button fullWidth disabled={!full || verifying} onClick={verify}>{verifying ? t('common.loading') : t('onboarding.verify')}</Button>
      </div>
    </div>
  );
}

function Key({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button onClick={onClick} style={{ height: 60, borderRadius: radius.md, border: 'none', background: muted ? 'transparent' : c.card, boxShadow: muted ? 'none' : '0 1px 3px rgba(26,26,24,.06)', font: `600 22px/1 ${font.ui}`, color: c.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {label === '⌫' ? <Icon name="chevronLeft" size={22} color={c.ink2} /> : label}
    </button>
  );
}
