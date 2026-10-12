import { fetchSlipImage } from '@/core/api/httpContent';
import type { Donation } from '@/core/api/types';
import { c, font, radius, shadow } from '@/core/theme/tokens';
import { fmtDate } from '@/features/fundraising/PartyFund.model';
import { fmtLKR } from '@/features/fundraising/PartyFund.model';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
export function PendingCard({
  donation,
  onReview,
  busy,
}: {
  donation: Donation;
  onReview: (a: 'approve' | 'reject') => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [img, setImg] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    if (donation.hasSlip) {
      fetchSlipImage(donation.id)
        .then((u) => {
          url = u;
          setImg(u);
        })
        .catch(() => setImgErr(true));
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [donation.id, donation.hasSlip]);

  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.hairline}`,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>🧾</span>
        <span style={{ flex: 1, font: `700 14px/1.25 ${font.ta}`, color: c.ink }}>
          {donation.donorName}
        </span>
        <span style={{ font: `800 15px/1 ${font.head}`, color: c.primary }}>
          {fmtLKR(donation.amount)}
        </span>
      </div>
      <div
        style={{ font: `400 11.5px/1.3 ${font.ui}`, color: c.ink3, marginTop: 4, marginLeft: 28 }}
      >
        {donation.districtName ? `${donation.districtName} · ` : ''}
        {fmtDate(donation.createdAt)}
      </div>

      {img && (
        <img
          src={img}
          alt={t('fund.slipTitle')}
          style={{
            width: '100%',
            borderRadius: radius.md,
            border: `1px solid ${c.hairline}`,
            marginTop: 12,
            display: 'block',
          }}
        />
      )}
      {imgErr && (
        <div style={{ font: `400 12px/1.4 ${font.ta}`, color: c.error, marginTop: 10 }}>
          {t('fund.badImage')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <button
          onClick={() => onReview('reject')}
          disabled={busy}
          className="press"
          style={{
            padding: '12px 0',
            borderRadius: radius.md,
            border: `1.5px solid ${c.error}`,
            background: 'transparent',
            color: c.error,
            cursor: 'pointer',
            font: `700 13.5px/1 ${font.ta}`,
          }}
        >
          {t('fund.reject')}
        </button>
        <button
          onClick={() => onReview('approve')}
          disabled={busy}
          className="press"
          style={{
            padding: '12px 0',
            borderRadius: radius.md,
            border: 'none',
            background: c.success,
            color: '#fff',
            cursor: 'pointer',
            font: `700 13.5px/1 ${font.ta}`,
          }}
        >
          {t('fund.approve')}
        </button>
      </div>
    </div>
  );
}
