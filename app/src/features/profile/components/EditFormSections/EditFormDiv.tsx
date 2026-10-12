import { type ServerMember } from '@/core/api/authApi';
import { c } from '@/core/theme/tokens';
import { HEADER_MID } from '@/features/profile/EditProfile.model';
import { HeaderChipButton } from '@/features/profile/components/HeaderChipButton';
import { Icon } from '@/shared/components/Icon';
import { NetImage } from '@/shared/components/nn';
import type { TFunction } from 'i18next';

type Props = {
  avatarPreview: string | null;
  t: TFunction<'translation', undefined>;
  me: ServerMember;
  galleryRef: import('react').RefObject<HTMLInputElement>;
  cameraRef: import('react').RefObject<HTMLInputElement>;
};
export function EditFormDiv({ avatarPreview, t, me, galleryRef, cameraRef }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 16,
      }}
    >
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: 'rgba(255,255,255,.22)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 3,
            borderRadius: 999,
            overflow: 'hidden',
            background: HEADER_MID,
          }}
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={t('editProfile.photoAlt')}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <NetImage
              src={me.avatarUrl ?? ''}
              alt={t('editProfile.photoAlt')}
              width={90}
              height={90}
              radius={999}
              fallbackIcon="user"
            />
          )}
        </span>
        <button
          onClick={() => galleryRef.current?.click()}
          aria-label={t('editProfile.changePhoto')}
          className="press"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 30,
            height: 30,
            borderRadius: 999,
            border: `2px solid ${HEADER_MID}`,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon name="camera" size={14} color={c.maroon} strokeWidth={2.2} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <HeaderChipButton
          icon="camera"
          label={t('fund.takePhoto')}
          onClick={() => cameraRef.current?.click()}
        />
        <HeaderChipButton
          icon="image"
          label={t('fund.chooseImage')}
          onClick={() => galleryRef.current?.click()}
        />
      </div>
    </div>
  );
}
