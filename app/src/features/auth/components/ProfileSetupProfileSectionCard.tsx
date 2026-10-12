import type { DsDivision } from '@/core/api/divisions';
import { DISTRICTS } from '@/core/api/divisions';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  pickDistrict: (code: string) => void;
  districtCode: string | null;
  setDsSheetOpen: Dispatch<SetStateAction<boolean>>;
  currentDs: DsDivision | undefined;
  dsCode: string | null;
  setGsSheetOpen: Dispatch<SetStateAction<boolean>>;
  gsLabel: string | null | undefined;
};
export function ProfileSetupProfileSectionCard({
  t,
  pickDistrict,
  districtCode,
  setDsSheetOpen,
  currentDs,
  dsCode,
  setGsSheetOpen,
  gsLabel,
}: Props) {
  return (
    <div className="profile-section-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="mapPin" size={16} color="#14263D" />
        <span
          style={{
            font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#1E293B',
          }}
        >
          {t('profileSetup.district')}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '2px 0 6px' }}>
        {DISTRICTS.map((dist) => (
          <button
            key={dist.code}
            type="button"
            onClick={() => pickDistrict(dist.code)}
            className={`profile-chip ${districtCode === dist.code ? 'active' : ''}`}
          >
            {dist.name_en}
          </button>
        ))}
      </div>

      <button type="button" className="profile-select-btn" onClick={() => setDsSheetOpen(true)}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#EFF6FF',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="landmark" size={18} color="#14263D" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 13px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#1E293B',
            }}
          >
            {t('profileSetup.ds')}
          </div>
          <div
            style={{
              font: `500 12.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: currentDs ? '#14263D' : '#64748B',
              marginTop: 3,
            }}
          >
            {currentDs ? currentDs.name_en : 'முதலில் மாவட்டத்தைத் தேர்ந்தெடுக்கவும்'}
          </div>
        </div>
        <Icon name="chevron" size={16} color="#94A3B8" />
      </button>

      <button
        type="button"
        className="profile-select-btn"
        onClick={() => dsCode && setGsSheetOpen(true)}
        style={{ opacity: dsCode ? 1 : 0.7 }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#EFF6FF',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="mapPin" size={18} color="#14263D" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 13px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#1E293B',
            }}
          >
            {t('profileSetup.gs')}
          </div>
          <div
            style={{
              font: `500 12.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: gsLabel ? '#14263D' : '#64748B',
              marginTop: 3,
            }}
          >
            {gsLabel ||
              (dsCode
                ? 'கிராம சேவை பிரிவைத் தேர்வுசெய்யுங்கள்'
                : 'முதலில் பிரதேச செயலாளர் பிரிவைத் தேர்வுசெய்யுங்கள்')}
          </div>
        </div>
        <Icon name="chevron" size={16} color="#94A3B8" />
      </button>
    </div>
  );
}
