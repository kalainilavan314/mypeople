import { useConfirmCardDonation } from '@/core/api/queries';
import { c, font, radius } from '@/core/theme/tokens';
import { digitsOnly } from '@/features/fundraising/PartyFund.model';
import { Sheet } from '@/features/fundraising/components/Sheet';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  setOtpOpen: Dispatch<SetStateAction<boolean>>;
  t: TFunction<'translation', undefined>;
  devCode: string | null;
  otp: string;
  setOtp: Dispatch<SetStateAction<string>>;
  error: string | null;
  verify: () => Promise<void>;
  confirm: ReturnType<typeof useConfirmCardDonation>;
};
export function CardFlowSheet({
  setOtpOpen,
  t,
  devCode,
  otp,
  setOtp,
  error,
  verify,
  confirm,
}: Props) {
  return (
    <Sheet onClose={() => setOtpOpen(false)}>
      <div style={{ font: `700 18px/1.25 ${font.ta}`, color: c.ink }}>{t('fund.otpTitle')}</div>
      <div style={{ font: `400 13px/1.5 ${font.ta}`, color: c.ink2, marginTop: 6 }}>
        {t('fund.otpBody')}
      </div>
      {devCode && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: c.warningBg,
            borderRadius: radius.md,
            font: `600 13px/1.4 ${font.ui}`,
            color: c.warning,
          }}
        >
          {t('fund.otpSandbox')}: <span style={{ font: `700 16px/1 ${font.mono}` }}>{devCode}</span>
        </div>
      )}
      <input
        value={otp}
        onChange={(e) => setOtp(digitsOnly(e.target.value).slice(0, 6))}
        placeholder="000000"
        inputMode="numeric"
        autoFocus
        aria-label={t('fund.otpTitle')}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 14,
          padding: '14px 0',
          textAlign: 'center',
          border: `1.5px solid ${c.hairline2}`,
          borderRadius: radius.md,
          background: c.cardCream,
          font: `700 24px/1 ${font.mono}`,
          color: c.ink,
          letterSpacing: '.4em',
          textIndent: '.4em',
        }}
      />
      {error && (
        <div
          role="alert"
          style={{ marginTop: 10, font: `500 13px/1.4 ${font.ta}`, color: c.error }}
        >
          {error}
        </div>
      )}
      <button
        onClick={verify}
        disabled={confirm.isPending}
        className="press"
        style={{
          width: '100%',
          marginTop: 16,
          padding: '14px 0',
          border: 'none',
          borderRadius: radius.lg,
          cursor: 'pointer',
          background: c.primary,
          color: '#fff',
          font: `700 15px/1 ${font.ta}`,
        }}
      >
        {confirm.isPending ? t('common.loading') : t('fund.otpConfirm')}
      </button>
    </Sheet>
  );
}
