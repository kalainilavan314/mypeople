import { setSavedLang } from '@/core/i18n';
import embeddedStyles0 from '@/core/theme/embedded/WelcomeScreen.css?inline';
import { font, radius } from '@/core/theme/tokens';
import { WelcomeDiv } from '@/features/auth/onboarding/components/WelcomeSections/WelcomeDiv';
import { markWelcomeSeen } from '@/features/auth/onboarding/WelcomeScreenModel/markWelcomeSeen';
import { Logo } from '@/shared/components/Logo';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function Welcome() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const activeLang = i18n.language === 'ta' ? 'ta' : 'en';

  const go = (to: '/signup' | '/login') => {
    markWelcomeSeen();

    navigate(to, { replace: true });
  };

  return (
    <div
      style={{
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{embeddedStyles0}</style>

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(14px + var(--safe-top, 0px)) 20px 10px',
          background: '#FFFFFF',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={42} style={{ borderRadius: 10 }} />
          <div>
            <span
              style={{
                display: 'block',
                font: `800 18.5px/1.15 ${font.ta}`,
                letterSpacing: '-0.2px',
                color: '#0F2137',
              }}
            >
              என் மக்கள்
            </span>
            <span
              style={{
                display: 'block',
                font: `600 12.5px/1.2 ${font.head}`,
                letterSpacing: '0.02em',
                color: '#64748B',
                marginTop: 1,
              }}
            >
              My People
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 3,
            borderRadius: radius.pill,
            background: '#EFF6FF',
            border: '1px solid rgba(191, 219, 254, 0.6)',
          }}
        >
          <button
            type="button"
            onClick={() => setSavedLang('ta')}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: radius.pill,
              cursor: 'pointer',
              border: 'none',
              background: activeLang === 'ta' ? '#14263D' : 'transparent',
              color: activeLang === 'ta' ? '#FFFFFF' : '#1D4ED8',
              font: `600 13px/1 ${font.ta}`,
              transition: 'all 160ms ease',
            }}
          >
            தமிழ்
          </button>
          <button
            type="button"
            onClick={() => setSavedLang('en')}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: radius.pill,
              cursor: 'pointer',
              border: 'none',
              background: activeLang === 'en' ? '#14263D' : 'transparent',
              color: activeLang === 'en' ? '#FFFFFF' : '#1D4ED8',
              font: `600 13px/1 ${font.ui}`,
              transition: 'all 160ms ease',
            }}
          >
            English
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div className="welcome-hero-wrap">
          <img
            src="/welcome-hero-map.png"
            alt="Northern & Eastern Province Map with District Network"
            className="welcome-hero-img"
            loading="eager"
          />
          <div className="welcome-hero-fade" />
        </div>

        <WelcomeDiv activeLang={activeLang} go={go} />
      </main>

      <svg
        viewBox="0 0 500 130"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: 130,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        <path d="M0 65 Q130 35 250 65 T500 45 L500 130 L0 130 Z" fill="rgba(224, 242, 254, 0.4)" />
        <path d="M0 85 Q140 55 280 80 T500 65 L500 130 L0 130 Z" fill="rgba(191, 219, 254, 0.28)" />
      </svg>
    </div>
  );
}
