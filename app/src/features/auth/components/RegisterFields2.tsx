import type { NicInfo } from '@/core/lib/nic';
import { authC, font, radius } from '@/core/theme/tokens';
import { NicCard } from '@/features/auth/components/NicCard';
import { NicPhotoTile } from '@/features/auth/components/NicPhotoTile';
import { FieldLabel, GreenButton } from '@/features/auth/components/parts';
import { signupDraft } from '@/features/auth/state/signupDraft';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  t: TFunction<'translation', undefined>;
  nicInfo: NicInfo;
  nicFrontPhoto: string | null;
  setNicFrontPhoto: Dispatch<SetStateAction<string | null>>;
  nicBackPhoto: string | null;
  setNicBackPhoto: Dispatch<SetStateAction<string | null>>;
  photosTouched: boolean;
  setPhotosTouched: Dispatch<SetStateAction<boolean>>;
  navigate: ReturnType<typeof useNavigate>;
};
export function RegisterFields2({
  t,
  nicInfo,
  nicFrontPhoto,
  setNicFrontPhoto,
  nicBackPhoto,
  setNicBackPhoto,
  photosTouched,
  setPhotosTouched,
  navigate,
}: Props) {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h1
          style={{
            font: `900 25px/1.25 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#14263D',
            margin: 0,
            letterSpacing: 'normal',
          }}
        >
          {t('auth.verifyNicTitle')}
        </h1>
        <p
          style={{
            font: `500 13.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#475569',
            margin: '8px 0 0',
            letterSpacing: 'normal',
          }}
        >
          {t('auth.verifyNicSub')}
        </p>
      </div>

      <NicCard info={nicInfo} />

      <div style={{ marginTop: 18 }}>
        <FieldLabel ta={t('auth.nicPhotosTitle')} />
        <p
          style={{
            font: `400 12.5px/1.5 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#64748B',
            margin: '0 0 10px',
          }}
        >
          {t('auth.nicPhotosSub')}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <NicPhotoTile
            label={t('auth.nicPhotoFront')}
            photo={nicFrontPhoto}
            onPick={(photo) => setNicFrontPhoto(photo)}
          />
          <NicPhotoTile
            label={t('auth.nicPhotoBack')}
            photo={nicBackPhoto}
            onPick={(photo) => setNicBackPhoto(photo)}
          />
        </div>
        {photosTouched && (!nicFrontPhoto || !nicBackPhoto) && (
          <div style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8 }}>
            {t('auth.errNicPhotos')}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: radius.md,
          background: '#EFF6FF',
          border: '1px solid #DBEAFE',
        }}
      >
        <Icon name="shield" size={18} color="#2563EB" style={{ marginTop: 2, flexShrink: 0 }} />
        <div
          style={{
            font: `400 12.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#1E293B',
            letterSpacing: 'normal',
            whiteSpace: 'pre-line',
          }}
        >
          {t('auth.verifyNicNote')}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 24 }} />

      <GreenButton
        onClick={() => {
          setPhotosTouched(true);
          if (!nicFrontPhoto || !nicBackPhoto) return;
          signupDraft.patch({ nicFrontPhoto, nicBackPhoto });
          navigate('/signup/profile');
        }}
      >
        <span
          style={{
            font: `800 16px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            letterSpacing: 'normal',
          }}
        >
          {t('auth.verifyFinish')}
        </span>
        <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
      </GreenButton>
    </>
  );
}
