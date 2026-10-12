import type { Donation } from '@/core/api/types';
import { c, font, radius } from '@/core/theme/tokens';
import { fmtLKR } from '@/features/fundraising/PartyFund.model';
import { Sheet } from '@/features/fundraising/components/Sheet';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  setDone: Dispatch<SetStateAction<Donation | null>>;
  onDone: () => void;
  t: TFunction<'translation', undefined>;
  done: Donation;
};
export function CardFlowSheet2({ setDone, onDone, t, done }: Props) {
  return (
    <Sheet
      onClose={() => {
        setDone(null);
        onDone();
      }}
    >
      <span
        style={{
          display: 'flex',
          width: 64,
          height: 64,
          margin: '0 auto',
          borderRadius: 999,
          background: c.successBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="check" size={32} color={c.success} strokeWidth={2.4} />
      </span>
      <div
        style={{
          font: `700 20px/1.2 ${font.ta}`,
          color: c.ink,
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        {t('fund.thanksTitle')}
      </div>
      <div
        style={{
          font: `400 14px/1.5 ${font.ta}`,
          color: c.ink2,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        {t('fund.thanksCard', { amount: fmtLKR(done.amount), last4: done.cardLast4 ?? '' })}
      </div>
      <button
        onClick={() => {
          setDone(null);
          onDone();
        }}
        className="press"
        style={{
          width: '100%',
          marginTop: 20,
          padding: '14px 0',
          border: 'none',
          borderRadius: radius.lg,
          cursor: 'pointer',
          background: c.primary,
          color: '#fff',
          font: `700 15px/1 ${font.ta}`,
        }}
      >
        {t('creport.done')}
      </button>
    </Sheet>
  );
}
