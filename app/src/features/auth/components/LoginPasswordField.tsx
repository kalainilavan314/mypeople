import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
};
export function LoginPasswordField({ t, password, setPassword, showPassword, setShowPassword }: Props) {
  return (
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
  );
}
