import { DISTRICTS, type GsFlat } from '@/core/api/divisions';
import { c, font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function GsSheet({
  districtCode,
  dsCode,
  selectedCode,
  onPick,
  onClose,
}: {
  districtCode: string;
  dsCode: string;
  selectedCode: string | null;
  onPick: (g: GsFlat) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const district = DISTRICTS.find((d) => d.code === districtCode)!;
  const ds = district?.ds.find((x) => x.code === dsCode);

  const results = useMemo(() => {
    if (!district || !ds) return [];
    const inDs: GsFlat[] = (ds.gn ?? []).map((g) => ({
      ...g,
      districtCode,
      districtName: district.name_en,
      dsCode,
      dsName: ds.name_en ?? '',
    }));
    const needle = q.trim().toLowerCase();
    if (!needle) return inDs;
    return inDs.filter(
      (g) => g.name.toLowerCase().includes(needle) || g.ref.toLowerCase().includes(needle),
    );
  }, [q, districtCode, district, ds, dsCode]);

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
          <div style={{ font: `800 17px/1.2 ${font.ta}`, color: c.primary, marginBottom: 12 }}>
            {ds?.name_en ?? district?.name_en} · {t('profileSetup.gs', 'GN பிரிவு')}
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
              placeholder={t('profileSetup.searchGs', 'தேடல் / Search GN Division')}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                font: `500 14px/1 ${font.ta}`,
                color: c.primary,
              }}
            />
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 14px 28px' }}>
          {results.map((g) => {
            const active = selectedCode === g.code;
            return (
              <button
                key={g.code}
                type="button"
                onClick={() => onPick(g)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 4,
                  transition: 'background 120ms ease',
                }}
              >
                <span
                  style={{
                    font: `700 12px/1 ${font.mono}`,
                    color: active ? c.primary : c.ink,
                    background: active ? '#DBEAFE' : '#F1F5F9',
                    padding: '5px 8px',
                    borderRadius: 6,
                    flex: 'none',
                  }}
                >
                  {g.ref}
                </span>
                <span
                  style={{
                    flex: 1,
                    font: `600 14.5px/1.3 ${font.ui}`,
                    color: active ? c.primary : c.ink,
                  }}
                >
                  {g.name}
                </span>
                {active && <Icon name="check" size={18} color={c.primary} strokeWidth={2.8} />}
              </button>
            );
          })}
          {results.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                font: `500 13px/1 ${font.ta}`,
                color: '#64748B',
              }}
            >
              {t('profileSetup.noResults', 'முடிவுகள் எதுவும் இல்லை')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
