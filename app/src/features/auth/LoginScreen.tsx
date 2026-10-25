import { ApiError, authApi } from '@/core/api/authApi';
import { isValidNic } from '@/core/lib/nic';
import embeddedStyles0 from '@/core/theme/embedded/LoginScreen.css?inline';
import { LoginLoginCardContainer } from '@/features/auth/components/LoginLoginCardContainer';
import { useAuth } from '@/shared/hooks/useAuth';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
        flex: 1,
        minHeight: '100%',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{embeddedStyles0}</style>

      <LoginLoginCardContainer
        navigate={navigate}
        t={t}
        canSubmit={canSubmit}
        doLogin={doLogin}
        nic={nic}
        password={password}
        touched={touched}
        nicOk={nicOk}
        setNic={setNic}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        error={error}
        busy={busy}
      />
    </div>
  );
}
