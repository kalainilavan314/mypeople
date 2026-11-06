import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  dsCode: string | null;
  setGsSheetOpen: Dispatch<SetStateAction<boolean>>;
  t: TFunction<'translation', undefined>;
  gs: import('@/core/api/divisions').GsDivision | null;
};
export function EditFormGsSelectButton({ dsCode, setGsSheetOpen, t, gs }: Props) {
  return (
    <button
      type="button"
      className="profile-select-btn"
      onClick={() => dsCode && setGsSheetOpen(true)}
      style={{ opacity: dsCode ? 1 : 0.6, marginTop: 10 }}
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
        <div style={{ font: `700 13px/1.2 ${font.ta}`, color: '#1E293B' }}>
          {t('editProfile.gs')}
        </div>
        <div
          style={{
            font: `500 13px/1.3 ${font.ta}`,
            color: gs ? '#14263D' : '#64748B',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {gs
            ? `${gs.name} (${gs.ref})`
            : dsCode
              ? t('profileSetup.pickGs')
              : t('profileSetup.pickDsFirst')}
        </div>
      </div>
      <Icon name="chevron" size={16} color="#94A3B8" />
    </button>
  );
}
