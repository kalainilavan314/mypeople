import { startCardDonation } from '@/core/api/httpContent';
import { useConfirmCardDonation } from '@/core/api/queries';
import type { Donation } from '@/core/api/types';
import { c, font, radius } from '@/core/theme/tokens';
import { detectBrand } from '@/features/fundraising/PartyFund.model';
import { digitsOnly } from '@/features/fundraising/PartyFund.model';
import { expiryOk } from '@/features/fundraising/PartyFund.model';
import { fmtLKR } from '@/features/fundraising/PartyFund.model';
import { luhnOk } from '@/features/fundraising/PartyFund.model';
import { CardFlowDiv } from '@/features/fundraising/components/CardFlowSections/CardFlowDiv';
import { CardFlowSheet } from '@/features/fundraising/components/CardFlowSections/CardFlowSheet';
import { CardFlowSheet2 } from '@/features/fundraising/components/CardFlowSections/CardFlowSheet2';
import { Icon } from '@/shared/components/Icon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export function CardFlow({ amount, onDone }: { amount: number; onDone: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirmCardDonation();

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [starting, setStarting] = useState(false);
  const [done, setDone] = useState<Donation | null>(null);

  const brand = detectBrand(number);

  const pay = async () => {
    setError(null);
    if (!luhnOk(number) || !brand) return setError(t('fund.badCard'));
    if (!name.trim()) return setError(t('fund.badName'));
    if (!expiryOk(expiry)) return setError(t('fund.badExpiry'));
    if (!/^\d{3}$/.test(cvv)) return setError(t('fund.badCvv'));
    setStarting(true);
    try {
      const r = await startCardDonation(amount);
      setDevCode(r.devCode ?? null);
      setOtp('');
      setOtpOpen(true);
    } catch {
      setError(navigator.onLine ? t('fund.error') : t('creport.offline'));
    } finally {
      setStarting(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) return setError(t('fund.badOtp'));
    try {
      const donation = await confirm.mutateAsync({
        amount,
        code: otp,
        last4: digitsOnly(number).slice(-4),
        brand: brand!,
      });
      setOtpOpen(false);
      setDone(donation);
    } catch {
      setError(t('fund.badOtp'));
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    border: `1px solid ${c.hairline2}`,
    borderRadius: radius.md,
    background: c.card,
    color: c.ink,
    font: `500 14px/1.4 ${font.ui}`,
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, marginBottom: 4 }}>
        {t('fund.cardDetails')}
      </div>
      <div style={{ font: `400 11.5px/1.5 ${font.ta}`, color: c.ink3, marginBottom: 12 }}>
        {t('fund.sandboxNote')}
      </div>

      <CardFlowDiv
        number={number}
        setNumber={setNumber}
        t={t}
        fieldStyle={fieldStyle}
        brand={brand}
      />

      <input
        value={name}
        onChange={(e) => setName(e.target.value.toUpperCase())}
        placeholder={t('fund.cardName')}
        autoComplete="off"
        aria-label={t('fund.cardName')}
        style={{ ...fieldStyle, marginBottom: 10, textTransform: 'uppercase' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input
          value={expiry}
          onChange={(e) => {
            const d = digitsOnly(e.target.value).slice(0, 4);
            setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
          }}
          placeholder="MM/YY"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t('fund.cardExpiry')}
          style={fieldStyle}
        />
        <input
          value={cvv}
          onChange={(e) => setCvv(digitsOnly(e.target.value).slice(0, 3))}
          placeholder="CVV"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="CVV"
          style={fieldStyle}
        />
      </div>

      {error && !otpOpen && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '11px 14px',
            background: c.errorBg,
            color: c.error,
            borderRadius: radius.md,
            font: `500 13px/1.4 ${font.ta}`,
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={pay}
        disabled={starting}
        className="press"
        style={{
          width: '100%',
          marginTop: 16,
          padding: '15px 0',
          border: 'none',
          borderRadius: radius.lg,
          cursor: 'pointer',
          background: c.primary,
          color: '#fff',
          font: `700 15px/1 ${font.ta}`,
          boxShadow: '0 8px 22px -8px rgba(20,38,61,.55)',
        }}
      >
        {starting ? t('common.loading') : t('fund.payAmount', { amount: fmtLKR(amount) })}
      </button>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 10,
        }}
      >
        <Icon name="check" size={13} color={c.success} strokeWidth={2.4} />
        <span style={{ font: `400 11px/1.4 ${font.ta}`, color: c.ink3 }}>
          {t('fund.secureNote')}
        </span>
      </div>

      {otpOpen && (
        <CardFlowSheet
          setOtpOpen={setOtpOpen}
          t={t}
          devCode={devCode}
          otp={otp}
          setOtp={setOtp}
          error={error}
          verify={verify}
          confirm={confirm}
        />
      )}

      {done && <CardFlowSheet2 setDone={setDone} onDone={onDone} t={t} done={done} />}
    </div>
  );
}
