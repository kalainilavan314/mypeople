import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  gender: string | null;
  setGender: Dispatch<SetStateAction<string | null>>;
};
export function EditFormGenderPicker({ t, gender, setGender }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {(
        [
          { id: 'male', label: t('profileSetup.male', 'ஆண்'), icon: 'male' as const },
          { id: 'female', label: t('profileSetup.female', 'பெண்'), icon: 'female' as const },
          {
            id: 'other',
            label: t('profileSetup.other', 'மற்றவை'),
            icon: 'genderOther' as const,
          },
        ] as const
      ).map((g) => {
        const on = gender === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => setGender(on ? null : g.id)}
            className={`profile-gender-pill ${on ? 'active' : ''}`}
          >
            <Icon name={g.icon} size={16} color={on ? '#FFFFFF' : '#64748B'} strokeWidth={2.2} />
            <span>{g.label}</span>
          </button>
        );
      })}
    </div>
  );
}
