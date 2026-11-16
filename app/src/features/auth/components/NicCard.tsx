import { formatDob, parseNic } from '@/core/lib/nic';
import { font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useTranslation } from 'react-i18next';

export function NicCard({ info }: { info: ReturnType<typeof parseNic> }) {
  const { t } = useTranslation();
  const rows: Array<[string, string]> = info.valid
    ? [
        [t('auth.nicNumber'), info.normalized],
        [t('auth.dob'), info.dob ? formatDob(info.dob) : '—'],
        [t('auth.gender'), t(info.gender === 'female' ? 'auth.female' : 'auth.male')],
        [t('auth.ageLabel'), String(info.age)],
      ]
    : [[t('auth.nicNumber'), info.normalized || '—']];
  return (
    <div
      style={{
        borderRadius: radius.lg,
        background: '#FFFFFF',
        border: `1.5px solid #E2E8F0`,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(20,38,61,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: `1px solid #E2E8F0`,
        }}
      >
        <Icon name="idCard" size={20} color="var(--primary)" />
        <span
          style={{
            font: `700 14px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: 'var(--primary)',
            letterSpacing: 'normal',
          }}
        >
          {t('auth.nicDetails')}
        </span>
      </div>
      <div style={{ padding: '6px 16px 12px' }}>
        {rows.map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              padding: '9px 0',
              borderBottom: `1px solid #F1F5F9`,
            }}
          >
            <span
              style={{
                font: `500 13px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#64748B',
                letterSpacing: 'normal',
              }}
            >
              {k}
            </span>
            <span
              style={{ font: `600 13px/1.3 ${font.mono}`, color: 'var(--primary)', textAlign: 'right' }}
            >
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
