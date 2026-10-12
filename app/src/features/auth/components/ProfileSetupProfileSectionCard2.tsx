import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  gender: 'other' | 'male' | 'female' | null;
  setGender: Dispatch<SetStateAction<'other' | 'male' | 'female' | null>>;
};
export function ProfileSetupProfileSectionCard2({ t, gender, setGender }: Props) {
  return (
    <div className="profile-section-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="user" size={16} color="#14263D" />
        <span
          style={{
            font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#1E293B',
          }}
        >
          {t('profileSetup.gender')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={`profile-gender-pill ${gender === 'male' ? 'active' : ''}`}
          onClick={() => setGender('male')}
        >
          <Icon name="male" size={16} strokeWidth={2.2} />
          <span>{t('profileSetup.male')}</span>
        </button>
        <button
          type="button"
          className={`profile-gender-pill ${gender === 'female' ? 'active' : ''}`}
          onClick={() => setGender('female')}
        >
          <Icon name="female" size={16} strokeWidth={2.2} />
          <span>{t('profileSetup.female')}</span>
        </button>
        <button
          type="button"
          className={`profile-gender-pill ${gender === 'other' ? 'active' : ''}`}
          onClick={() => setGender('other')}
        >
          <Icon name="genderOther" size={16} strokeWidth={2} />
          <span>{t('profileSetup.other')}</span>
        </button>
      </div>
    </div>
  );
}
