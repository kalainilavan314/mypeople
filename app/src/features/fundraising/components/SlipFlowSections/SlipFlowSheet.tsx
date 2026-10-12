import { c, font, radius } from '@/core/theme/tokens';
import { Sheet } from '@/features/fundraising/components/Sheet';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  setDone: Dispatch<SetStateAction<boolean>>;
  onDone: () => void;
  t: TFunction<'translation', undefined>;
};
export function SlipFlowSheet({ setDone, onDone, t }: Props) {
  return (
    <Sheet
      onClose={() => {
        setDone(false);
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
          background: c.warningBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="clock" size={32} color={c.warning} strokeWidth={2} />
      </span>
      <div
        style={{
          font: `700 20px/1.2 ${font.ta}`,
          color: c.ink,
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        {t('fund.slipSentTitle')}
      </div>
      <div
        style={{
          font: `400 14px/1.5 ${font.ta}`,
          color: c.ink2,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        {t('fund.slipSentBody')}
      </div>
      <button
        onClick={() => {
          setDone(false);
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
