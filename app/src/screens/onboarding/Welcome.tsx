import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { font, radius } from '../../theme/tokens';
import { Logo } from '../../components/Logo';
import { Icon } from '../../components/Icon';
import { setSavedLang } from '../../i18n';

/**
 * Modern Civic Welcome Landing Screen
 * Pixel-accurate implementation matching the official launch design:
 * - Brand header with logo, title ("என் மக்கள் / My People"), and language switch pill
 * - Scenic North & East district network illustration (/welcome-hero-map.png)
 * - Northern & Eastern Province location badge pill
 * - Signature Tamil headline typography: "இலக்கு ஒன்றுதான் / இனத்தின் விடிவு"
 * - Decorative 3-petal lotus flourish divider
 * - Deep navy gradient CTA button ("Join the Community →")
 * - Direct member sign-in link ("Already a member? Sign In")
 */
const WELCOME_SEEN = 'npm.seenWelcome';

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN) === '1';
  } catch {
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN, '1');
  } catch {
    /* ignore */
  }
}

export function Welcome() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const activeLang = i18n.language === 'ta' ? 'ta' : 'en';

  const go = (to: '/signup' | '/login') => {
    markWelcomeSeen();
    // Replace, not push: Welcome is a splash, not a step to come back to —
    // without this, the back button loops Login -> Welcome -> Login forever.
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
      <style>{`
        .welcome-hero-wrap {
          position: relative;
          width: 100%;
          flex: 1 1 0;
          min-height: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #FFFFFF;
          overflow: hidden;
        }
        .welcome-hero-img {
          width: 100%;
          max-width: 480px;
          height: 100%;
          max-height: 100%;
          display: block;
          object-fit: contain;
        }
        .welcome-hero-fade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 48px;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 100%);
          pointer-events: none;
        }
        .welcome-cta-btn {
          width: 100%;
          max-width: 350px;
          height: 54px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          background: linear-gradient(180deg, #182E4B 0%, #0F1E32 100%);
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 25px -4px rgba(15, 30, 50, 0.42), 0 3px 8px rgba(15, 30, 50, 0.2);
          transition: transform 120ms ease, box-shadow 120ms ease;
          font-weight: 700;
          font-size: 16.5px;
          letter-spacing: 0.01em;
        }
        .welcome-cta-btn:active {
          transform: scale(0.98);
          box-shadow: 0 4px 14px rgba(15, 30, 50, 0.3);
        }
      `}</style>

      {/* ---------- Brand Header ---------- */}
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

        {/* Clean Pill Language Switcher */}
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

      {/* ---------- Main Content ---------- */}
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
        {/* Scenic Map Hero Illustration */}
        <div className="welcome-hero-wrap">
          <img
            src="/welcome-hero-map.png"
            alt="Northern & Eastern Province Map with District Network"
            className="welcome-hero-img"
            loading="eager"
          />
          <div className="welcome-hero-fade" />
        </div>

        {/* Content Section below Map */}
        <div
          style={{
            width: '100%',
            flex: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2px 20px calc(16px + var(--safe-bottom, 0px))',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Province Location Pill Badge - Compact & Refined */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: radius.pill,
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.05)',
            }}
          >
            <Icon name="mapPin" size={13} color="#0F2137" strokeWidth={2.4} />
            <span
              style={{
                font: `600 12px/1.2 ${font.ui}`,
                color: '#0F2137',
                letterSpacing: '0.01em',
              }}
            >
              {activeLang === 'ta'
                ? 'வடக்கு, கிழக்கு மாகாணம், இலங்கை'
                : 'Northern & Eastern Province, Sri Lanka'}
            </span>
          </div>

          {/* Slogan Core Headline */}
          <h1
            style={{
              font: `800 30px/1.26 ${font.taSerif}`,
              color: '#0F2137',
              margin: '12px 0 0',
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            இலக்கு ஒன்றுதான்
            <br />
            இனத்தின் விடிவு
          </h1>

          {/* Decorative 3-Petal Lotus Divider */}
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              width: '100%',
              maxWidth: 190,
              margin: '10px auto 0',
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#BFDBFE' }} />
            <svg width="22" height="15" viewBox="0 0 24 18" fill="none" style={{ display: 'block', flex: 'none' }}>
              <path
                d="M12 2C12 2 8.5 7.5 8.5 12C8.5 14.5 10 16.5 12 16.5C14 16.5 15.5 14.5 15.5 12C15.5 7.5 12 2 12 2Z"
                fill="#2563EB"
              />
              <path
                d="M9.5 13C8 13 3.5 12 2 8C2 8 5.5 7 8 9.5C9.2 10.7 9.5 12 9.5 13Z"
                fill="#60A5FA"
              />
              <path
                d="M14.5 13C16 13 20.5 12 22 8C22 8 18.5 7 16 9.5C14.8 10.7 14.5 12 14.5 13Z"
                fill="#60A5FA"
              />
            </svg>
            <div style={{ flex: 1, height: 1, background: '#BFDBFE' }} />
          </div>

          {/* Call to Action Button */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => go('/signup')}
              className="welcome-cta-btn"
            >
              <span style={{ font: `700 16px/1 ${activeLang === 'ta' ? font.ta : font.ui}` }}>
                {activeLang === 'ta' ? 'சமூகத்தில் இணையுங்கள்' : 'Join the Community'}
              </span>
              <Icon name="arrowRight" size={18} color="#FFFFFF" strokeWidth={2.4} />
            </button>
          </div>

          {/* Already a member? Sign In */}
          <button
            type="button"
            onClick={() => go('/login')}
            style={{
              display: 'block',
              margin: '12px auto 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 12px',
              font: `500 14px/1.3 ${activeLang === 'ta' ? font.ta : font.ui}`,
              color: '#4B5563',
            }}
          >
            {activeLang === 'ta' ? 'ஏற்கனவே உறுப்பினரா? ' : 'Already a member? '}
            <span style={{ color: '#0F2137', fontWeight: 800 }}>
              {activeLang === 'ta' ? 'உள்நுழைக' : 'Sign In'}
            </span>
          </button>
        </div>
      </main>

      {/* Decorative subtle blue bottom wave swoosh matching the screenshot */}
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
        <path
          d="M0 65 Q130 35 250 65 T500 45 L500 130 L0 130 Z"
          fill="rgba(224, 242, 254, 0.4)"
        />
        <path
          d="M0 85 Q140 55 280 80 T500 65 L500 130 L0 130 Z"
          fill="rgba(191, 219, 254, 0.28)"
        />
      </svg>
    </div>
  );
}
