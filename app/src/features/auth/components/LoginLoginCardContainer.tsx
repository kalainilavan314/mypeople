import { isValidNic } from '@/core/lib/nic';
import { LoginDiv } from '@/features/auth/components/LoginDiv';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { LangToggle } from '@/features/auth/components/parts';
import { Icon } from '@/shared/components/Icon';
import { Logo } from '@/shared/components/Logo';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  navigate: ReturnType<typeof useNavigate>;
  t: TFunction<'translation', undefined>;
  canSubmit: boolean;
  doLogin: (useNic: string, usePassword: string) => Promise<void>;
  nic: string;
  password: string;
  touched: boolean;
  nicOk: ReturnType<typeof isValidNic>;
  setNic: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  busy: boolean;
};
export function LoginLoginCardContainer({
  navigate,
  t,
  canSubmit,
  doLogin,
  nic,
  password,
  touched,
  nicOk,
  setNic,
  setPassword,
  showPassword,
  setShowPassword,
  error,
  busy,
}: Props) {
  return (
    <div className="login-card-container">
      <div className="login-hero-artwork" aria-hidden="true">
        <img src="/login-bg.png" alt="" className="login-hero-img" />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'calc(14px + var(--safe-top, 0px)) 22px calc(24px + var(--safe-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
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

        {/* Breathing space for the Jaffna coastal lighthouse hero artwork */}
        <div style={{ flex: '0.4 1 auto', minHeight: 6, maxHeight: 32 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo
            size={46}
            style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)' }}
          />
          <div>
            <div
              style={{
                font: `900 21px/1.1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#14263D',
                letterSpacing: '-0.01em',
              }}
            >
              {t('brand.nameTa')}
            </div>
            <div
              style={{
                font: `700 12px/1 var(--font-ui, 'Inter', sans-serif)`,
                color: '#14263D',
                marginTop: 3,
              }}
            >
              {t('brand.name')}
            </div>
          </div>
        </div>

        <h1
          style={{
            font: `900 25px/1.2 var(--font-ui, 'Inter', sans-serif)`,
            letterSpacing: '-0.025em',
            color: '#0F2137',
            margin: '16px 0 0',
          }}
        >
          {t('auth.welcomeBack', 'Welcome back')}
        </h1>

        <div
          style={{
            display: 'flex',
            background: '#F1F5F9',
            padding: 4,
            borderRadius: 999,
            marginTop: 16,
            border: '1px solid rgba(20, 38, 61, 0.04)',
          }}
        >
          <button type="button" className="login-tab-pill active">
            {t('auth.login', 'Login')}
          </button>
          <button type="button" className="login-tab-pill" onClick={() => navigate('/signup')}>
            {t('auth.createAccount', 'Create Account')}
          </button>
        </div>

        <LoginForm
          canSubmit={canSubmit}
          doLogin={doLogin}
          nic={nic}
          password={password}
          t={t}
          touched={touched}
          nicOk={nicOk}
          setNic={setNic}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          navigate={navigate}
          error={error}
          busy={busy}
        />

        {/* Grouped directly under primary button */}
        <div
          style={{
            marginTop: 16,
            textAlign: 'center',
            font: `500 13px/1.4 var(--font-ui, 'Inter', sans-serif)`,
            color: '#4B5563',
          }}
        >
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

        {/* Controlled spacer to bottom trust badges */}
        <div style={{ flex: '1 1 auto', minHeight: 20, maxHeight: 60 }} />

        <div style={{ marginTop: 'auto', width: '100%' }}>
          <LoginDiv t={t} />
        </div>
      </div>
    </div>
  );
}
