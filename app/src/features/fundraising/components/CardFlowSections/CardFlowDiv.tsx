import { c, font } from '@/core/theme/tokens';
import { detectBrand } from '@/features/fundraising/PartyFund.model';
import { formatCardNumber } from '@/features/fundraising/PartyFund.model';
import type { TFunction } from 'i18next';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';

type Props = {
  number: string;
  setNumber: Dispatch<SetStateAction<string>>;
  t: TFunction<'translation', undefined>;
  fieldStyle: CSSProperties;
  brand: ReturnType<typeof detectBrand>;
};
export function CardFlowDiv({ number, setNumber, t, fieldStyle, brand }: Props) {
  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <input
        value={number}
        onChange={(e) => setNumber(formatCardNumber(e.target.value))}
        placeholder="1234 5678 9012 3456"
        inputMode="numeric"
        autoComplete="off"
        aria-label={t('fund.cardNumber')}
        style={{ ...fieldStyle, paddingRight: 84, font: `500 15px/1.4 ${font.mono}` }}
      />
      <span style={{ position: 'absolute', right: 12, top: 11, display: 'flex', gap: 4 }}>
        <span
          style={{
            font: `800 11px/1 ${font.ui}`,
            color: brand === 'visa' ? '#1A1F71' : c.ink4,
            background: c.cardCream,
            borderRadius: 4,
            padding: '6px 6px',
          }}
        >
          VISA
        </span>
        <span
          style={{
            font: `800 11px/1 ${font.ui}`,
            color: brand === 'mastercard' ? '#EB001B' : c.ink4,
            background: c.cardCream,
            borderRadius: 4,
            padding: '6px 4px',
          }}
        >
          MC
        </span>
      </span>
    </div>
  );
}
