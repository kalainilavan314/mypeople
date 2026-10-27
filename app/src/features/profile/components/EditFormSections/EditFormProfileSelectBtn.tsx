import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  district: import('@/core/api/divisions').District | null;
  setDsSheetOpen: Dispatch<SetStateAction<boolean>>;
  t: TFunction<'translation', undefined>;
  ds: import('@/core/api/divisions').DsDivision | null;
};
export function EditFormProfileSelectBtn({ district, setDsSheetOpen, t, ds }: Props) {
  return (
    <button
      type="button"
      className="profile-select-btn"
      onClick={() => district && setDsSheetOpen(true)}
      style={{ opacity: district ? 1 : 0.6 }}
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
        <Icon name="landmark" size={18} color="#14263D" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 13px/1.2 ${font.ta}`, color: '#1E293B' }}>
          {t('editProfile.ds')}
        </div>
        <div
          style={{
            font: `500 13px/1.3 ${font.ta}`,
            color: ds ? '#14263D' : '#64748B',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ds
            ? ds.name_en
            : district
              ? t('profileSetup.pickDs')
              : t('profileSetup.pickDistrictFirst')}
        </div>
      </div>
      <Icon name="chevron" size={16} color="#94A3B8" />
    </button>
  );
}
