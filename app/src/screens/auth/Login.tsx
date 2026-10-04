import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { authApi, ApiError } from '../../data/authApi';
import { useAuth } from '../../state/auth';
import { isValidNic } from '../../lib/nic';
import { AuthPage, Field, FieldLabel, GreenButton, LinkText, LangToggle, LogoBars, SegTabs, Wordmark } from './parts';

export function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login } = useAuth();

  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
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
    <AuthPage>
      <div style={{ flex: 1, padding: '14px 22px calc(28px + var(--safe-bottom))', display: 'flex', flexDirection: 'column' }}>
        {/* ---------- top bar: back + language ---------- */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            aria-label={t('common.back')}
            style={{ width: 40, height: 40, marginLeft: -8, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Icon name="chevronLeft" size={24} color={authC.text} strokeWidth={2.2} />
          </button>
          <LangToggle />
        </div>

        {/* ---------- brand ----------
            Mark beside the name rather than stacked above it: at 26px the logo
            read as an afterthought next to a 30px wordmark, and the pairing is
            how the identity appears on the organisation's own card. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogoBars height={48} />
          <Wordmark size={26} />
        </div>

        <h1 style={{ font: `700 20px/1.3 ${font.head}`, color: authC.text, margin: '14px 0 0' }}>{t('auth.welcomeCommunity')}</h1>
        <p style={{ font: `400 15px/1.5 ${font.ui}`, color: authC.text2, margin: '6px 0 0' }}>{t('auth.communitySub')}</p>

        {/* ---------- Login / Create account ---------- */}
        <div style={{ marginTop: 22 }}>
          <SegTabs
            active="login"
            onSelect={(k) => k === 'signup' && navigate('/signup')}
            tabs={[
              { key: 'login', label: t('auth.login') },
              { key: 'signup', label: t('auth.createAccount') },
            ]}
          />
        </div>

        {/* ---------- credentials: NIC + password (no mobile, no OTP) ---------- */}
        <div style={{ marginTop: 20 }}>
          <FieldLabel ta={t('auth.nicLabel')} en="NIC number" />
          <Field
            icon="idCard"
            value={nic}
            onChange={(v) => setNic(v.toUpperCase())}
            placeholder="199512345678 / 951234567V"
            autoCapitalize="characters"
            maxLength={12}
            error={touched && nic.length > 0 && !nicOk}
            ariaLabel={t('auth.nicLabel')}
          />
          {touched && nic.length > 0 && !nicOk && (
            <div style={{ marginTop: 6, font: `500 12px/1.4 ${font.ui}`, color: authC.error }}>{t('auth.errNic')}</div>
          )}

          <div style={{ height: 14 }} />
          <FieldLabel ta={t('auth.passwordLabel')} en="Password" />
          <Field icon="lock" value={password} onChange={setPassword} placeholder="••••••••" password ariaLabel={t('auth.passwordLabel')} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <LinkText onClick={() => navigate('/forgot')}>{t('auth.forgot')}</LinkText>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: authC.errorSoft, color: authC.error, font: `500 12.5px/1.4 ${font.ui}` }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <GreenButton onClick={() => void doLogin(nic, password)} disabled={!canSubmit} loading={busy}>
            {t('auth.loginToCommunity')}
          </GreenButton>
        </div>

        <div style={{ flex: 1, minHeight: 18 }} />

        <div style={{ textAlign: 'center', font: `500 13px/1 ${font.ui}`, color: authC.text2 }}>
          {t('auth.noAccount')} <LinkText onClick={() => navigate('/signup')}>{t('auth.signUp')}</LinkText>
        </div>
      </div>
    </AuthPage>
  );
}

