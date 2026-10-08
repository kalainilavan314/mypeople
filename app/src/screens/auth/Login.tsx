import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Lock as LucideLock, Users as LucideUsers } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { authC } from '../../theme/tokens';
import { Logo } from '../../components/Logo';
import { authApi, ApiError } from '../../data/authApi';
import { useAuth } from '../../state/auth';
import { isValidNic } from '../../lib/nic';
import { LangToggle } from './parts';

export function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login } = useAuth();

  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nicOk = isValidNic(nic);
  const canSubmit = nic.trim().length > 0 && password.length > 0 && !busy;

  const doLogin = async (useNic: string, usePassword: string) => {
    setTouched(true);
    setError(null);
    const cleanNic = useNic.trim().toUpperCase();
    if (!isValidNic(cleanNic)) {
      setError(t('auth.errNic'));
      return;
    }
    setBusy(true);
    try {
      await authApi.login(cleanNic, usePassword);
      login();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[Login Error]', err);
      const code = err instanceof ApiError ? err.code : 'network';
      setError(
        code === 'network'
          ? t('auth.errNetwork')
          : code === 'too_many_attempts'
            ? t('auth.errTooMany')
            : code === 'invalid_credentials'
              ? t('auth.errCredentials')
              : t('auth.errServer'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#EDF4FC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px calc(24px + var(--safe-bottom, 0px))',
      }}
    >
      <style>{`
        .login-card-container {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border-radius: 36px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(16, 45, 85, 0.12), 0 2px 10px rgba(16, 45, 85, 0.04);
          display: flex;
          flex-direction: column;
        }
        .login-hero-artwork {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 250px;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
        }
        .login-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: right top;
          opacity: 0.92;
          mask-image: radial-gradient(ellipse 95% 100% at 100% 0%, rgba(0, 0, 0, 1) 30%, rgba(0, 0, 0, 0.7) 55%, rgba(0, 0, 0, 0.2) 75%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 95% 100% at 100% 0%, rgba(0, 0, 0, 1) 30%, rgba(0, 0, 0, 0.7) 55%, rgba(0, 0, 0, 0.2) 75%, transparent 100%);
        }
        .login-tab-pill {
          flex: 1;
          height: 44px;
          border-radius: 999px;
          border: none;
          background: transparent;
          font: 700 14px/1 var(--font-ui, 'Inter', sans-serif);
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 180ms ease;
        }
        .login-tab-pill.active {
          background: #14263D;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(20, 38, 61, 0.28);
        }
        .login-input-box {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 54px;
          padding: 0 16px;
          border-radius: 14px;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
        }
        .login-input-box:focus-within {
          background: #ffffff;
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .login-input-box.error {
          border-color: #EF4444;
          background: #FEF2F2;
        }
        .login-native-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font: 600 15px/1 var(--font-ui, 'Inter', sans-serif);
          color: #0F2137;
        }
        .login-native-input::placeholder {
          color: #94A3B8;
          font-weight: 400;
        }
        .login-cta-button {
          width: 100%;
          height: 52px;
          border-radius: 999px;
          border: none;
          background: #14263D;
          color: #ffffff;
          font: 700 15.5px/1 var(--font-ui, 'Inter', sans-serif);
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 24px -4px rgba(20, 38, 61, 0.42);
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
        }
        .login-cta-button:active {
          transform: scale(0.98);
        }
        .login-cta-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }
        .login-trust-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 4px;
        }
        .login-trust-icon-circle {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #EFF6FF;
          display: grid;
          place-items: center;
          margin-bottom: 3px;
        }
      `}</style>

      <div className="login-card-container">
        {/* Top-Right Scenic Coastal Illustration Mask */}
        <div className="login-hero-artwork" aria-hidden="true">
          <img
            src="/login-bg.png"
            alt=""
            className="login-hero-img"
          />
        </div>

        {/* Content Body */}
        <div style={{ position: 'relative', zIndex: 2, padding: '24px 24px 28px', display: 'flex', flexDirection: 'column' }}>
          {/* Top Bar: Back button & Language toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => navigate('/welcome')}
              aria-label={t('common.back', 'Back')}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                border: '1px solid rgba(20, 38, 61, 0.1)',
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: '#14263D',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              }}
            >
              <Icon name="chevronLeft" size={18} color="#14263D" strokeWidth={2.6} />
            </button>
            <LangToggle />
          </div>

          {/* Brand Identity Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo size={46} style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)' }} />
            <div>
              <div style={{ font: `900 21px/1.1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', letterSpacing: '-0.01em' }}>
                {t('brand.nameTa')}
              </div>
              <div style={{ font: `700 12px/1 var(--font-ui, 'Inter', sans-serif)`, color: '#14263D', marginTop: 3 }}>
                {t('brand.name')}
              </div>
            </div>
          </div>

          {/* Headline & Description */}
          <h1
            style={{
              font: `900 28px/1.2 var(--font-ui, 'Inter', sans-serif)`,
              letterSpacing: '-0.025em',
              color: '#0F2137',
              margin: '18px 0 0',
            }}
          >
            {t('auth.welcomeBack', 'Welcome back')}
          </h1>
          <p
            style={{
              font: `450 13.5px/1.5 var(--font-ui, 'Inter', sans-serif)`,
              color: '#4B5563',
              margin: '8px 0 0',
              maxWidth: 350,
            }}
          >
            {t('auth.welcomeBackSub', 'Securely login to access community services, local updates, and participation features for the Northern and Eastern community.')}
          </p>

          {/* Segmented Pill Tabs: Login / Create Account */}
          <div
            style={{
              display: 'flex',
              background: '#F1F5F9',
              padding: 4,
              borderRadius: 999,
              marginTop: 22,
              border: '1px solid rgba(20, 38, 61, 0.04)',
            }}
          >
            <button type="button" className="login-tab-pill active">
              {t('auth.login', 'Login')}
            </button>
            <button
              type="button"
              className="login-tab-pill"
              onClick={() => navigate('/signup')}
            >
              {t('auth.createAccount', 'Create Account')}
            </button>
          </div>

          {/* Credentials Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) void doLogin(nic, password);
            }}
            style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* NIC Field */}
            <div>
              <label
                htmlFor="auth-nic-input"
                style={{
                  display: 'block',
                  font: `700 13px/1 var(--font-ui, 'Inter', sans-serif)`,
                  color: '#1E293B',
                  marginBottom: 8,
                }}
              >
                {t('auth.nicNumber', 'NIC number')}
              </label>
              <div className={`login-input-box ${touched && nic.length > 0 && !nicOk ? 'error' : ''}`}>
                <Icon name="idCard" size={20} color="#64748B" strokeWidth={2} />
                <input
                  id="auth-nic-input"
                  className="login-native-input"
                  value={nic}
                  onChange={(e) => setNic(e.target.value.toUpperCase())}
                  placeholder="200223201090"
                  autoCapitalize="characters"
                  maxLength={12}
                  autoComplete="username"
                />
              </div>
              {touched && nic.length > 0 && !nicOk && (
                <div style={{ marginTop: 6, font: `600 12px/1.3 var(--font-ui, 'Inter', sans-serif)`, color: '#EF4444' }}>
                  {t('auth.errNic')}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="auth-password-input"
                style={{
                  display: 'block',
                  font: `700 13px/1 var(--font-ui, 'Inter', sans-serif)`,
                  color: '#1E293B',
                  marginBottom: 8,
                }}
              >
                {t('auth.passwordLabel', 'Password')}
              </label>
              <div className="login-input-box">
                <Icon name="lock" size={20} color="#64748B" strokeWidth={2} />
                <input
                  id="auth-password-input"
                  className="login-native-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••••••••••"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#64748B',
                  }}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} color="#64748B" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
              <button
                type="button"
                onClick={() => navigate('/forgot')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  font: `700 12.5px/1 var(--font-ui, 'Inter', sans-serif)`,
                  color: '#2563EB',
                  padding: '4px 0',
                }}
              >
                {t('auth.forgot', 'Forgot Password?')}
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: authC.errorSoft,
                  color: authC.error,
                  font: `600 13px/1.4 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon name="info" size={16} color={authC.error} strokeWidth={2.4} />
                <span>{error}</span>
              </div>
            )}

            {/* Primary Login Button */}
            <div style={{ marginTop: 6 }}>
              <button
                type="submit"
                className="login-cta-button"
                disabled={!canSubmit}
              >
                {busy ? (
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      border: '2.5px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'authSpin 700ms linear infinite',
                    }}
                  />
                ) : (
                  <>
                    <span>{t('auth.loginToCommunity', 'Login to Community')}</span>
                    <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.5} />
                  </>
                )}
              </button>
              <style>{'@keyframes authSpin { to { transform: rotate(360deg); } }'}</style>
            </div>
          </form>

          {/* Sign Up Link */}
          <div style={{ marginTop: 18, textAlign: 'center', font: `500 13px/1.4 var(--font-ui, 'Inter', sans-serif)`, color: '#4B5563' }}>
            {t('auth.noAccount', "Don't have an account?")}{' '}
            <button
              type="button"
              onClick={() => navigate('/signup')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                font: `700 13px/1.4 var(--font-ui, 'Inter', sans-serif)`,
                color: '#2563EB',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {t('auth.signUp', 'Sign up')}
            </button>
          </div>

          {/* Flat Trust & Security Icons (Unified Bluish Gray Theme) */}
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              paddingBottom: 4,
              borderTop: '1px solid rgba(20, 38, 61, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
            }}
          >
            <div
              title={t('auth.trustSecureTitle', 'பாதுகாப்பானது')}
              aria-label={t('auth.trustSecureTitle', 'பாதுகாப்பானது')}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 6px rgba(20, 38, 61, 0.04)',
                transition: 'transform 0.15s ease',
              }}
            >
              <ShieldCheck size={19} strokeWidth={2.2} color="#3B5270" />
            </div>

            <div
              style={{
                width: 1,
                height: 20,
                background: 'rgba(20, 38, 61, 0.12)',
                borderRadius: 1,
              }}
              aria-hidden="true"
            />

            <div
              title={t('auth.trustPrivateTitle', 'தனிப்பட்டது')}
              aria-label={t('auth.trustPrivateTitle', 'தனிப்பட்டது')}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 6px rgba(20, 38, 61, 0.04)',
                transition: 'transform 0.15s ease',
              }}
            >
              <LucideLock size={17} strokeWidth={2.2} color="#3B5270" />
            </div>

            <div
              style={{
                width: 1,
                height: 20,
                background: 'rgba(20, 38, 61, 0.12)',
                borderRadius: 1,
              }}
              aria-hidden="true"
            />

            <div
              title={t('auth.trustCommunityTitle', 'சமூக முன்னுரிமை')}
              aria-label={t('auth.trustCommunityTitle', 'சமூக முன்னுரிமை')}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 6px rgba(20, 38, 61, 0.04)',
                transition: 'transform 0.15s ease',
              }}
            >
              <LucideUsers size={18} strokeWidth={2.2} color="#3B5270" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
