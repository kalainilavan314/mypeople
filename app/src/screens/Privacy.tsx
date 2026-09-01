import { useTranslation } from 'react-i18next';
import { c, font, radius } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { QueryBoundary, Toggle } from '../components/ui';
import { useConsents, useSetConsent } from '../data/queries';
import type { ConsentKind } from '../data/types';

const ROWS: { kind: ConsentKind; ta: string; en: string }[] = [
  { kind: 'data', ta: 'எனது தரவைச் சேமிக்க அனுமதி', en: 'Store my membership data' },
  { kind: 'whatsapp', ta: 'WhatsApp வழி அறிவிப்புகள்', en: 'Notifications via WhatsApp' },
  { kind: 'research', ta: 'ஆய்வுக்காக அநாமதேயத் தரவு', en: 'Anonymised data for research' },
];

export function Privacy() {
  const { t } = useTranslation();
  const consentsQ = useConsents();
  const setConsent = useSetConsent();

  return (
    <div>
      <ScreenHeader titleTa={t('profile.privacy')} titleEn="Privacy & consent" />
      <div style={{ padding: '16px 16px 28px' }}>
        <QueryBoundary query={consentsQ}>
          {(consents) => (
            <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, overflow: 'hidden' }}>
              {ROWS.map((r, i) => (
                <div key={r.kind} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderTop: i ? `1px solid ${c.hairline}` : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `600 14px/1.4 ${font.ta}`, color: c.ink }}>{r.ta}</div>
                    <div style={{ font: `400 12px/1.4 ${font.ui}`, color: c.ink3 }}>{r.en}</div>
                  </div>
                  <Toggle on={consents[r.kind]} onChange={(v) => setConsent.mutate({ kind: r.kind, value: v })} ariaLabel={r.en} />
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>

        {/* Data actions */}
        <div style={{ marginTop: 18, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, overflow: 'hidden' }}>
          <ActionRow icon="share" ta="எனது தரவைப் பதிவிறக்கு" en="Download my data" />
          <ActionRow icon="lock" ta="தனியுரிமைக் கொள்கை" en="Privacy policy" border />
        </div>

        <button style={{ width: '100%', height: 52, marginTop: 18, borderRadius: radius.pill, border: `1px solid ${c.error}`, background: 'transparent', color: c.error, font: `600 15px/1 ${font.ta}`, cursor: 'pointer' }}>
          உறுப்புரிமையை நீக்கு · Delete membership
        </button>
        <div style={{ font: `400 11px/1.5 ${font.ui}`, color: c.ink3, textAlign: 'center', marginTop: 10 }}>
          Your NIC is encrypted and never shown to other members.
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon, ta, en, border }: { icon: 'share' | 'lock'; ta: string; en: string; border?: boolean }) {
  return (
    <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', background: 'transparent', border: 'none', borderTop: border ? `1px solid ${c.hairline}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: c.maroonTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={18} color={c.maroon} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>{ta}</span>
        <span style={{ display: 'block', font: `400 12px/1.3 ${font.ui}`, color: c.ink3 }}>{en}</span>
      </span>
      <Icon name="chevron" size={18} color={c.ink3} strokeWidth={2} />
    </button>
  );
}
