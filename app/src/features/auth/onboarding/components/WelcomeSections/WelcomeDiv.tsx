import { font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

type Props = { activeLang: 'ta' | 'en'; go: (to: '/signup' | '/login') => void };
export function WelcomeDiv({ activeLang, go }: Props) {
  return (
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
        <svg
          width="22"
          height="15"
          viewBox="0 0 24 18"
          fill="none"
          style={{ display: 'block', flex: 'none' }}
        >
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

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <button type="button" onClick={() => go('/signup')} className="welcome-cta-btn">
          <span style={{ font: `700 16px/1 ${activeLang === 'ta' ? font.ta : font.ui}` }}>
            {activeLang === 'ta' ? 'சமூகத்தில் இணையுங்கள்' : 'Join the Community'}
          </span>
          <Icon name="arrowRight" size={18} color="#FFFFFF" strokeWidth={2.4} />
        </button>
      </div>

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
  );
}
