import { isValidNic } from '@/core/lib/nic';
import { authC } from '@/core/theme/tokens';
import { LoginPasswordField } from '@/features/auth/components/LoginPasswordField';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  canSubmit: boolean;
  doLogin: (useNic: string, usePassword: string) => Promise<void>;
  nic: string;
  password: string;
  t: TFunction<'translation', undefined>;
  touched: boolean;
  nicOk: ReturnType<typeof isValidNic>;
  setNic: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  navigate: ReturnType<typeof useNavigate>;
  error: string | null;
  busy: boolean;
};
export function LoginForm({
  canSubmit,
  doLogin,
  nic,
  password,
  t,
  touched,
  nicOk,
  setNic,
  setPassword,
  showPassword,
  setShowPassword,
  navigate,
  error,
  busy,
}: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) void doLogin(nic, password);
      }}
      style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 13 }}
    >
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
          <div
            style={{
              marginTop: 6,
              font: `600 12px/1.3 var(--font-ui, 'Inter', sans-serif)`,
              color: '#DC2626',
            }}
          >
            {t('auth.errNic')}
          </div>
        )}
      </div>

      <LoginPasswordField
        t={t}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
        <button
          type="button"
          onClick={() => navigate('/forgot')}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            font: `700 12.5px/1 var(--font-ui, 'Inter', sans-serif)`,
            color: 'var(--primary)',
            padding: '4px 0',
          }}
        >
          {t('auth.forgot', 'Forgot Password?')}
        </button>
      </div>

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

      <div style={{ marginTop: 6 }}>
        <button type="submit" className="login-cta-button" disabled={!canSubmit}>
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
  );
}
