import { type ServerMember } from '@/core/api/authApi';
import { font } from '@/core/theme/tokens';
import { HEADER_TOP } from '@/features/profile/EditProfile.model';
import { EditFormDiv } from '@/features/profile/components/EditFormSections/EditFormDiv';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  navigate: ReturnType<typeof useNavigate>;
  t: TFunction<'translation', undefined>;
  avatarPreview: string | null;
  me: ServerMember;
  galleryRef: import('react').RefObject<HTMLInputElement>;
  cameraRef: import('react').RefObject<HTMLInputElement>;
  onFile: (f: File | undefined | null) => Promise<void>;
};
export function EditFormHeader({
  navigate,
  t,
  avatarPreview,
  me,
  galleryRef,
  cameraRef,
  onFile,
}: Props) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
        padding: '14px 20px 24px',
        background: HEADER_TOP,
        borderRadius: '0 0 32px 32px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: 999,
          background: 'rgba(255,255,255,.06)',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back', 'Back')}
          style={{
            width: 38,
            height: 38,
            marginLeft: -8,
            borderRadius: 999,
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon
            name="chevron"
            size={22}
            color="#fff"
            strokeWidth={2.2}
            style={{ transform: 'rotate(180deg)' }}
          />
        </button>
        <span
          style={{
            width: 4,
            height: 20,
            borderRadius: 2,
            background: 'var(--brand-yellow)',
          }}
        />
        <span style={{ font: `800 20px/1 ${font.head}`, letterSpacing: '-0.3px' }}>
          {t('profile.editProfile')}
        </span>
      </div>

      <EditFormDiv
        avatarPreview={avatarPreview}
        t={t}
        me={me}
        galleryRef={galleryRef}
        cameraRef={cameraRef}
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void onFile(file);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void onFile(file);
        }}
      />
    </div>
  );
}
