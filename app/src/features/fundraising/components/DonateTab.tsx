import { authApi } from '@/core/api/authApi';
import { c, font, radius } from '@/core/theme/tokens';
import { CardFlow } from '@/features/fundraising/components/CardFlow';
import { MethodCard } from '@/features/fundraising/components/MethodCard';
import { SlipFlow } from '@/features/fundraising/components/SlipFlow';
import { digitsOnly } from '@/features/fundraising/PartyFund.model';
import { GOLD } from '@/features/fundraising/PartyFund.model';
import { PRESETS } from '@/features/fundraising/PartyFund.model';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
export function DonateTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<'card' | 'slip' | null>(null);

  const [cardEnabled, setCardEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    authApi.config().then((cfg) => {
      if (live) setCardEnabled(!!cfg.cardPaymentsEnabled);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!cardEnabled && method === 'card') setMethod(null);
  }, [cardEnabled, method]);

  const effAmount = custom ? Number(digitsOnly(custom)) : amount;
  const amountOk = Number.isFinite(effAmount) && effAmount >= 100 && effAmount <= 1000000;

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, marginBottom: 12 }}>
        {t('fund.amount')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {PRESETS.map((p) => {
          const on = !custom && amount === p;
          return (
            <button
              key={p}
              onClick={() => {
                setAmount(p);
                setCustom('');
              }}
              aria-pressed={on}
              style={{
                padding: '12px 0',
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'center',
                background: on ? `${GOLD}18` : c.cardCream,
                border: `${on ? 2 : 1}px solid ${on ? GOLD : c.hairline2}`,
                font: `${on ? 700 : 500} 13px/1 ${font.ui}`,
                color: on ? c.primary : c.ink2,
              }}
            >
              {p.toLocaleString()}
            </button>
          );
        })}
      </div>
      <input
        value={custom}
        onChange={(e) => setCustom(digitsOnly(e.target.value).slice(0, 7))}
        placeholder={t('fund.customAmount')}
        inputMode="numeric"
        aria-label={t('fund.customAmount')}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 10,
          padding: '13px 14px',
          border: `1px solid ${custom ? GOLD : c.hairline2}`,
          borderRadius: radius.md,
          background: c.card,
          color: c.ink,
          font: `500 14px/1.4 ${font.ui}`,
        }}
      />
      {!amountOk && custom && (
        <div style={{ font: `500 12px/1.4 ${font.ta}`, color: c.error, marginTop: 6 }}>
          {t('fund.amountRange')}
        </div>
      )}

      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, margin: '20px 0 12px' }}>
        {t('fund.method')}
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: cardEnabled ? '1fr 1fr' : '1fr', gap: 10 }}
      >
        {cardEnabled && (
          <MethodCard
            icon="card"
            title={t('fund.methodCard')}
            sub={t('fund.methodCardSub')}
            active={method === 'card'}
            onClick={() => setMethod('card')}
          />
        )}
        <MethodCard
          icon="fileText"
          title={t('fund.methodSlip')}
          sub={t('fund.methodSlipSub')}
          active={method === 'slip'}
          onClick={() => setMethod('slip')}
        />
      </div>

      {cardEnabled && method === 'card' && amountOk && (
        <CardFlow amount={effAmount} onDone={onDone} />
      )}
      {method === 'slip' && amountOk && <SlipFlow amount={effAmount} onDone={onDone} />}
    </div>
  );
}
