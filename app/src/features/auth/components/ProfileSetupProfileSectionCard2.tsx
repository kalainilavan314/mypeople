import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  gender: 'other' | 'male' | 'female' | null;
  setGender: Dispatch<SetStateAction<'other' | 'male' | 'female' | null>>;
  /** The gender the NIC number records, when the number could be read. */
  nicGender: 'male' | 'female' | null;
};
export function ProfileSetupProfileSectionCard2({ t, gender, setGender, nicGender }: Props) {
  const differs = nicGender !== null && gender !== null && gender !== nicGender;
  return (
    <div className="profile-section-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="user" size={16} color="var(--primary)" />
        <span
          style={{
            font: `700 15px/1.3 ${font.ui}`,
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
          aria-pressed={gender === 'male'}
          onClick={() => setGender('male')}
        >
          <Icon name="male" size={16} strokeWidth={2.2} />
          <span>{t('profileSetup.male')}</span>
        </button>
        <button
          type="button"
          className={`profile-gender-pill ${gender === 'female' ? 'active' : ''}`}
          aria-pressed={gender === 'female'}
          onClick={() => setGender('female')}
        >
          <Icon name="female" size={16} strokeWidth={2.2} />
          <span>{t('profileSetup.female')}</span>
        </button>
        <button
          type="button"
          className={`profile-gender-pill ${gender === 'other' ? 'active' : ''}`}
          aria-pressed={gender === 'other'}
          onClick={() => setGender('other')}
        >
          <Icon name="genderOther" size={16} strokeWidth={2} />
          <span>{t('profileSetup.other')}</span>
        </button>
      </div>
      {differs && (
        <p role="note" style={{ margin: 0, font: `400 14px/1.55 ${font.ui}`, color: '#334155' }}>
          {t('profileSetup.genderDiffers')}
        </p>
      )}
    </div>
  );
}
