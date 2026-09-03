import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font, radius } from '../../theme/tokens';
import { LangToggle } from '../auth/parts';
import { Logo } from '../../components/Logo';

/**
 * First-launch welcome (NorthUnity reference): light warm-paper screen with the
 * brand row on top, an animated palmyrah path drawing inside a radial glow —
 * five pulsing district dots and their connection lines — then the province
 * badge, the "Every person is a part of the North." tagline and the gold
 * "Join the Community" call to action.
 *
 * Shown once — `markWelcomeSeen()` sets the flag and the router skips straight
 * to /login afterwards.
 */
const WELCOME_SEEN = 'npm.seenWelcome';

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN) === '1';
  } catch {
    return true; // storage blocked — don't trap the user on the splash
  }
}
export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN, '1');
  } catch {
    /* ignore */
  }
}

/* District dots — positions and colours from the NorthUnity reference. */
const DISTRICTS = [
  { name: 'Jaffna', color: '#E8A838', x: 0.5, y: 0.18 },
  { name: 'Kilinochchi', color: '#4A90D9', x: 0.52, y: 0.38 },
  { name: 'Mannar', color: '#6B9E5E', x: 0.2, y: 0.42 },
  { name: 'Mullaitivu', color: '#E07B54', x: 0.72, y: 0.35 },
  { name: 'Vavuniya', color: '#9B6BB5', x: 0.5, y: 0.6 },
] as const;

/* Connection lines radiate from the centre at these angles (degrees). */
const CONNECTION_ANGLES = [-60, -20, 20, 60, 100];

const GOLD = '#E8A838';
const INK = '#1C1917';

export function Welcome() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const go = (to: '/signup' | '/login') => {
    markWelcomeSeen();
    navigate(to, { replace: true });
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: authC.bg }}>
      {/* Scoped animations: path draw, dot pulse, staggered fades. */}
      <style>{`
        @keyframes nuDraw { to { stroke-dashoffset: 0; } }
        @keyframes nuFade { to { opacity: 1; transform: none; } }
        @keyframes nuPulse {
          0%, 100% { transform: scale(.6); opacity: .55; }
          50% { transform: scale(1); opacity: 0; }
        }
        .nu-path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: nuDraw 1s cubic-bezier(.65,0,.35,1) forwards; }
        .nu-fade { opacity: 0; transform: translateY(12px); animation: nuFade .7s cubic-bezier(.22,.61,.36,1) forwards; }
        .nu-dot { opacity: 0; animation: nuFade .5s ease-out forwards; }
        .nu-ring { animation: nuPulse 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .nu-path { animation-duration: 1ms; }
          .nu-fade, .nu-dot { animation-duration: 1ms; }
          .nu-ring { animation: none; opacity: 0; }
        }
      `}</style>

      {/* ---------- brand row ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 24px 0' }}>
        <Logo size={36} style={{ borderRadius: 10 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', font: `800 18px/1.1 ${font.ta}`, letterSpacing: '-0.2px', color: INK }}>
            {t('brand.nameTa')}
          </span>
          <span style={{ display: 'block', font: `600 12px/1.2 ${font.head}`, letterSpacing: '-0.2px', color: INK, opacity: 0.72, marginTop: 2 }}>
            {t('brand.name')}
          </span>
        </span>
        <LangToggle />
      </div>

      {/* ---------- animation area ---------- */}
      <div style={{ flex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: '12px 0' }}>
        <div style={{ position: 'relative', width: 'min(85vw, 340px)', aspectRatio: '1' }}>
          {/* radial glow */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,168,56,.10) 0%, rgba(74,144,217,.05) 55%, transparent 75%)',
            }}
          />

          {/* palmyrah path drawing — trunk, fronds, district connection lines */}
          <svg viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', inset: '7.5%', width: '85%', height: '85%' }} aria-hidden="true">
            {/* province boundary ring */}
            <circle cx="50" cy="50" r="42" stroke="rgba(232,168,56,.16)" strokeWidth="1" className="nu-path" pathLength={1} style={{ animationDelay: '.2s', animationDuration: '1.4s' }} />
            {/* trunk */}
            <path d="M50 88 C 48 65, 52 45, 50 40" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" className="nu-path" pathLength={1} style={{ animationDelay: '.35s' }} />
            {/* fronds — left, right, top */}
            {[
              'M50 40 C 42 34, 32 28, 25 25',
              'M50 40 C 44 32, 40 24, 38 16',
              'M50 40 C 45 37, 33 35, 22 36',
              'M50 40 C 58 34, 68 28, 75 25',
              'M50 40 C 56 32, 60 24, 62 16',
              'M50 40 C 55 37, 67 35, 78 36',
              'M50 40 C 50 32, 50 24, 50 18',
            ].map((d, i) => (
              <path
                key={d}
                d={d}
                stroke={GOLD}
                strokeWidth="1.8"
                strokeLinecap="round"
                className="nu-path"
                pathLength={1}
                style={{ animationDelay: `${0.75 + i * 0.08}s`, animationDuration: '.7s' }}
              />
            ))}
            {/* community connection lines */}
            {CONNECTION_ANGLES.map((a, i) => {
              const rad = (a * Math.PI) / 180;
              const x2 = 50 + 38 * Math.cos(rad);
              const y2 = 50 + 38 * Math.sin(rad);
              return (
                <line
                  key={a}
                  x1="50"
                  y1="50"
                  x2={x2}
                  y2={y2}
                  stroke="rgba(74,144,217,.5)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  className="nu-path"
                  pathLength={1}
                  style={{ animationDelay: `${1.4 + i * 0.06}s`, animationDuration: '.6s' }}
                />
              );
            })}
          </svg>

          {/* district dots + labels */}
          {DISTRICTS.map((d, i) => (
            <div
              key={d.name}
              className="nu-dot"
              style={{
                position: 'absolute',
                left: `${d.x * 100}%`,
                top: `${d.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                animationDelay: `${1.7 + i * 0.12}s`,
              }}
            >
              <span style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span aria-hidden="true" className="nu-ring" style={{ position: 'absolute', inset: 0, borderRadius: 999, background: d.color, animationDelay: `${i * 0.2}s` }} />
                <span style={{ width: 12, height: 12, borderRadius: 999, background: d.color, boxShadow: `0 0 6px 1px ${d.color}66` }} />
              </span>
              <span
                style={{
                  font: `600 9px/1 ${font.ui}`, color: d.color, background: '#fff',
                  padding: '3px 6px', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.08)', whiteSpace: 'nowrap',
                }}
              >
                {d.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- tagline + CTA ---------- */}
      <div style={{ flex: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px calc(24px + var(--safe-bottom))' }}>
        <div className="nu-fade" style={{ textAlign: 'center', animationDelay: '2s' }}>
          {/* province badge */}
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              background: '#FFF3D6', border: '1px solid rgba(232,168,56,.3)', borderRadius: radius.pill,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: GOLD }} />
            <span style={{ font: `600 12px/1.2 ${font.ui}`, color: GOLD, letterSpacing: '.3px' }}>{t('welcome.badge')}</span>
          </span>

          <h1 style={{ font: `800 28px/1.25 ${font.head}`, letterSpacing: '-0.5px', color: INK, margin: '16px 0 0' }}>
            {t('welcome.line1')}
            <br />
            {t('welcome.line2')}
          </h1>

          <div style={{ font: `400 16px/1.5 ${font.ui}`, color: '#6B6560', marginTop: 12 }}>{t('welcome.sub')}</div>
        </div>

        <div className="nu-fade" style={{ marginTop: 36, animationDelay: '2.3s' }}>
          <button
            type="button"
            onClick={() => go('/signup')}
            className="press"
            style={{
              width: '100%', padding: '18px 0', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: GOLD, color: '#fff', font: `700 17px/1 ${font.head}`, letterSpacing: '.3px',
              boxShadow: '0 10px 26px -8px rgba(232,168,56,.55)',
            }}
          >
            {t('welcome.cta')}
          </button>

          <button
            type="button"
            onClick={() => go('/login')}
            style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', cursor: 'pointer', font: `400 14px/1 ${font.ui}`, color: '#9E9E9E' }}
          >
            {t('welcome.member')} <span style={{ color: GOLD, fontWeight: 600 }}>{t('welcome.signIn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
