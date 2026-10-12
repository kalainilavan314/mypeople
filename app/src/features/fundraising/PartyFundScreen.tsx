import { useDonationBoard } from '@/core/api/queries';
import { c, font, grad, radius } from '@/core/theme/tokens';
import { fmtLKR } from '@/features/fundraising/PartyFund.model';
import { DonateTab } from '@/features/fundraising/components/DonateTab';
import { DonorsTab } from '@/features/fundraising/components/DonorsTab';
import { ReviewTab } from '@/features/fundraising/components/ReviewTab';
import { Icon } from '@/shared/components/Icon';
import { useMe } from '@/shared/hooks/useMe';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function PartyFund() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const me = useMe();
  const isAdmin = !!me?.isAdmin;
  const [tab, setTab] = useState(0);
  const boardQ = useDonationBoard();

  const tabs = [
    t('fund.tabDonate'),
    t('fund.tabDonors'),
    ...(isAdmin ? [t('fund.tabReview')] : []),
  ];

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${c.primaryContainer} 0%, ${c.page} 70%)`,
          padding: '10px 16px 14px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Icon
          name="heart"
          size={80}
          color={c.primary}
          strokeWidth={1.4}
          style={{ position: 'absolute', top: 14, right: 14, opacity: 0.12 }}
        />
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back', 'Back')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginLeft: -10,
          }}
        >
          <Icon
            name="chevron"
            size={22}
            color={c.ink}
            strokeWidth={2.2}
            style={{ transform: 'rotate(180deg)' }}
          />
        </button>
        <div style={{ font: `700 24px/1.2 ${font.head}`, color: c.ink, marginTop: 26 }}>
          {t('fund.title')}
        </div>
      </div>

      <div style={{ padding: '4px 16px 0' }}>
        <div
          style={{
            background: grad.primary,
            borderRadius: radius.xl,
            padding: '18px 20px',
            boxShadow: '0 8px 20px -6px rgba(20,38,61,.42)',
            color: '#fff',
          }}
        >
          <div
            style={{
              font: `600 11px/1 ${font.ui}`,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            {t('fund.raised')}
          </div>
          <div style={{ font: `800 30px/1.15 ${font.head}`, marginTop: 6 }}>
            {boardQ.data ? fmtLKR(boardQ.data.total) : '—'}
          </div>
          <div style={{ font: `400 12.5px/1.4 ${font.ta}`, opacity: 0.9, marginTop: 4 }}>
            {boardQ.data ? t('fund.raisedSub', { n: boardQ.data.count }) : t('common.loading')}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${c.hairline}`,
          marginTop: 16,
          position: 'sticky',
          top: 0,
          background: c.page,
          zIndex: 5,
        }}
      >
        {tabs.map((label, i) => {
          const active = tab === i;
          return (
            <button
              key={label}
              onClick={() => setTab(i)}
              style={{
                flex: 1,
                padding: '13px 0 11px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                font: `${active ? 600 : 400} 14px/1 ${font.ta}`,
                color: active ? c.primary : c.ink2,
                borderBottom: `2.5px solid ${active ? c.primary : 'transparent'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 0 && <DonateTab onDone={() => setTab(1)} />}
      {tab === 1 && <DonorsTab />}
      {tab === 2 && isAdmin && <ReviewTab />}
    </div>
  );
}
