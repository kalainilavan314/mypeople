import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { c, font, radius } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { PalmyraMark } from '../components/PalmyraMark';
import { ScreenHeader } from '../components/ScreenHeader';
import { QueryBoundary, StatusPill } from '../components/ui';
import { useReferral } from '../data/queries';

export function Referral() {
  const { t } = useTranslation();
  const refQ = useReferral();
  const [copied, setCopied] = useState(false);

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <ScreenHeader titleTa={t('profile.referrals')} titleEn="Refer a friend" />
      <QueryBoundary query={refQ}>
        {(ref) => (
          <div style={{ padding: '16px 16px 28px' }}>
            <div style={{ position: 'relative', overflow: 'hidden', background: c.maroon, borderRadius: radius.xl, padding: '22px 20px', color: '#FFFFFF', textAlign: 'center' }}>
              <PalmyraMark size={200} style={{ position: 'absolute', right: -50, top: -40 }} />
              <div style={{ position: 'relative', font: `500 12px/1 ${font.ui}`, color: 'rgba(255,246,236,.7)', letterSpacing: '.1em', textTransform: 'uppercase' }}>உங்கள் அழைப்புக் குறியீடு · Your code</div>
              <div style={{ position: 'relative', font: `700 34px/1 ${font.mono}`, letterSpacing: '.08em', margin: '12px 0' }}>{ref.code}</div>
              <button onClick={() => copy(ref.code)} style={{ position: 'relative', height: 46, padding: '0 20px', borderRadius: 999, border: 'none', background: '#FFFFFF', color: c.maroon, font: `600 14px/1 ${font.ta}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name={copied ? 'check' : 'share'} size={17} color={c.maroon} />
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>

            {/* Share channels */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {[{ l: 'WhatsApp', i: 'share' as const }, { l: 'SMS', i: 'share' as const }].map((ch) => (
                <button key={ch.l} onClick={() => copy(ref.code)} style={{ flex: 1, height: 48, borderRadius: radius.md, border: `1px solid ${c.hairline}`, background: c.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', font: `600 14px/1 ${font.ui}`, color: c.ink0 }}>
                  <Icon name={ch.i} size={17} color={c.maroon} />
                  {ch.l}
                </button>
              ))}
            </div>

            {/* Referred list */}
            <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, margin: '24px 0 12px' }}>அழைத்தவர்கள் · Referred</div>
            <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, overflow: 'hidden' }}>
              {ref.referred.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? `1px solid ${c.hairline}` : 'none' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 999, background: c.maroonTint, color: c.maroon, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `600 14px/1 ${font.ui}`, flex: 'none' }}>{p.name[0]}</span>
                  <span style={{ flex: 1, font: `600 14px/1.3 ${font.ui}`, color: c.ink }}>{p.name}</span>
                  <StatusPill label={p.status === 'verified' ? 'சரிபார்க்கப்பட்டது' : 'நிலுவையில்'} tone={p.status === 'verified' ? 'success' : 'warning'} />
                </div>
              ))}
            </div>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
