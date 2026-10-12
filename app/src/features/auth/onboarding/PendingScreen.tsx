import { c, font } from '@/core/theme/tokens';
import { PalmyraMark } from '@/features/card/components/PalmyraMark';
import { Icon } from '@/shared/components/Icon';
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Pending() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login } = useAuth();

  const enter = () => {
    login();
    navigate('/', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 28px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <PalmyraMark
        size={280}
        opacity={0.06}
        stroke={c.maroon}
        style={{ position: 'absolute', top: -40 }}
      />
      <div
        style={{
          position: 'relative',
          width: 96,
          height: 96,
          borderRadius: 999,
          background: c.maroonTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="check" size={44} color={c.maroon} strokeWidth={2.2} />
      </div>
      <h1
        style={{
          position: 'relative',
          font: `700 24px/1.4 ${font.ta}`,
          color: c.ink,
          margin: '24px 0 8px',
        }}
      >
        {t('onboarding.pendingTitle')}
      </h1>
      <p
        style={{
          position: 'relative',
          font: `400 15px/1.7 ${font.ui}`,
          color: c.ink2,
          maxWidth: 300,
        }}
      >
        {t('onboarding.pendingBody')}
      </p>
      <div style={{ position: 'relative', width: '100%', maxWidth: 320, marginTop: 24 }}>
        <Button fullWidth onClick={enter}>
          {t('onboarding.explore')}
        </Button>
      </div>
    </div>
  );
}
