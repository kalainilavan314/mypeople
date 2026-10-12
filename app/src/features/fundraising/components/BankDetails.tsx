import { c, font, radius } from '@/core/theme/tokens';
import { BANK } from '@/features/fundraising/PartyFund.model';
import { Icon } from '@/shared/components/Icon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export function BankDetails() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {
      /* clipboard blocked (insecure origin, or denied) — the value is on screen */
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: radius.md,
        background: c.card,
        border: `1px solid ${c.hairline}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: `1px solid ${c.hairline}`,
        }}
      >
        <Icon name="card" size={17} color={c.maroon} />
        <span style={{ font: `700 13px/1 ${font.ta}`, color: c.ink }}>{t('fund.bankTitle')}</span>
      </div>
      {BANK.map(([key, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => copy(key, value)}
          aria-label={`${t(`fund.${key}`)}: ${value}`}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            border: 'none',
            borderTop: `1px solid ${c.hairline3}`,
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ font: `400 12.5px/1.3 ${font.ui}`, color: c.ink3 }}>
            {t(`fund.${key}`)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{ font: `600 13px/1.3 ${font.mono}`, color: c.ink, overflowWrap: 'anywhere' }}
            >
              {value}
            </span>
            <Icon
              name={copied === key ? 'check' : 'share'}
              size={14}
              color={copied === key ? c.success : c.ink4}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
