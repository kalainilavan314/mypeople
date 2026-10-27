import { DISTRICTS } from '@/core/api/divisions';
import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function DsSheet({
  district,
  selectedCode,
  onPick,
  onClose,
}: {
  district: (typeof DISTRICTS)[0];
  selectedCode: string | null;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return district.ds;
    return district.ds.filter((x) => x.name_en.toLowerCase().includes(needle));
  }, [district, q]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        maxWidth: 'var(--app-max)',
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20, 38, 61, 0.45)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          maxHeight: '75%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -16px 48px rgba(20, 38, 61, 0.25)',
          overflow: 'hidden',
          zIndex: 1,
          animation: 'npmFadeUp 200ms ease-out',
        }}
      >
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #E2E8F0' }}>
          <div
            style={{
              width: 44,
              height: 4.5,
              borderRadius: 999,
              background: '#CBD5E1',
              margin: '0 auto 14px',
            }}
          />
          <div style={{ font: `800 17px/1.2 ${font.ta}`, color: '#14263D', marginBottom: 12 }}>
            {district.name_en} · {t('profileSetup.ds', 'DS பிரிவு')}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 46,
              padding: '0 14px',
              borderRadius: 12,
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
            }}
          >
            <Icon name="search" size={18} color="#64748B" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('profileSetup.searchDs')}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                font: `500 14px/1 ${font.ta}`,
                color: '#14263D',
              }}
            />
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 14px 28px' }}>
          {list.map((ds) => {
            const active = selectedCode === ds.code;
            return (
              <button
                key={ds.code}
                type="button"
                onClick={() => onPick(ds.code)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer',
                  padding: '13px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  transition: 'background 120ms ease',
                }}
              >
                <div>
                  <div
                    style={{
                      font: `700 15px/1.2 ${font.ui}`,
                      color: active ? '#1D4ED8' : '#14263D',
                    }}
                  >
                    {ds.name_en}
                  </div>
                </div>
                {active && <Icon name="check" size={18} color="#1D4ED8" strokeWidth={2.8} />}
              </button>
            );
          })}
          {list.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                font: `500 13px/1 ${font.ta}`,
                color: '#64748B',
              }}
            >
              {t('profileSetup.noResults')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
