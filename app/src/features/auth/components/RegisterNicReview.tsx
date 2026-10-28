import type { NicInfo } from '@/core/lib/nic';
import { authC, font, radius } from '@/core/theme/tokens';
import { NicCard } from '@/features/auth/components/NicCard';
import { GreenButton } from '@/features/auth/components/parts';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  t: TFunction<'translation', undefined>;
  nicInfo: NicInfo;
  navigate: ReturnType<typeof useNavigate>;
};

/**
 * Step 2: the details read from the NIC number. Nothing here is verified: the
 * number's format is all the app can check. This step used to collect photos of
 * the NIC, but the live API has nowhere to keep them, so they were dropped at the
 * end of sign-up while the screen said the NIC was "verified automatically".
 * Identity review with photos and a selfie belongs to the /v1 identity flow.
 */
export function RegisterNicReview({ t, nicInfo, navigate }: Props) {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ font: `800 24px/1.3 ${font.ui}`, color: authC.text, margin: 0 }}>
          {t('auth.verifyNicTitle')}
        </h1>
        <p style={{ font: `400 15px/1.55 ${font.ui}`, color: authC.text3, margin: '8px 0 0' }}>
          {t('auth.verifyNicSub')}
        </p>
      </div>

      <NicCard info={nicInfo} />

      <div
        role="note"
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: radius.md,
          background: 'var(--warning-bg)',
          border: '1px solid #FDE68A',
        }}
      >
        <Icon name="info" size={18} color="var(--warning-text)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ font: `400 14px/1.6 ${font.ui}`, color: authC.text, whiteSpace: 'pre-line' }}>
          {t('auth.verifyNicNote')}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 24 }} />

      <GreenButton onClick={() => navigate('/signup/profile')}>
        <span style={{ font: `700 16px/1 ${font.ui}` }}>{t('auth.verifyFinish')}</span>
        <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
      </GreenButton>
    </>
  );
}
