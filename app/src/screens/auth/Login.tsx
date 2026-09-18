import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font, radius } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { authApi, ApiError } from '../../data/authApi';
import { useAuth } from '../../state/auth';
import { isValidNic } from '../../lib/nic';
import { AuthPage, Field, FieldLabel, GreenButton, LinkText, LangToggle, LogoBars, SegTabs, Wordmark } from './parts';

/** Demo credentials surfaced on the login card (seeded by server/src/seed-demo.js). */
const DEMO = { nic: '990740623V', password: 'kalai' };

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
    if (!isValidNic(useNic)) {
      setError(t('auth.errNic'));
      return;
    }
    setBusy(true);
    try {
      await authApi.login(useNic, usePassword);
      login();
      navigate('/', { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'network';
      setError(code === 'network' ? t('auth.errNetwork') : t('auth.errCredentials'));
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setNic(DEMO.nic);
    setPassword(DEMO.password);
    void doLogin(DEMO.nic, DEMO.password);
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

        {/* The demo account is a DEV-only convenience. It must never be exposed in
            production, where publishing working credentials on the login screen is
            an open door — so this whole block is compiled out of the prod build. */}
        {import.meta.env.DEV && (<>
        {/* ---------- or ---------- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <span style={{ flex: 1, height: 1, background: authC.line }} />
          <span style={{ font: `400 13px/1 ${font.ui}`, color: authC.text3 }}>{t('auth.or')}</span>
          <span style={{ flex: 1, height: 1, background: authC.line }} />
        </div>

        {/* ---------- demo account ---------- */}
        <div style={{ background: authC.greenSoft, border: `1px solid ${authC.line}`, borderRadius: radius.md, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <Icon name="shield" size={16} color={authC.green} strokeWidth={2} />
            <span style={{ font: `700 13.5px/1 ${font.ui}`, color: authC.green }}>{t('auth.demoAccount')}</span>
          </div>
          <DemoRow label={t('auth.nicLabel')} value={DEMO.nic} />
          <DemoRow label={t('auth.passwordLabel')} value={DEMO.password} />
          <button
            type="button"
            onClick={useDemo}
            disabled={busy}
            className="press"
            style={{
              marginTop: 14, width: '100%', height: 48, borderRadius: radius.sm, border: 'none',
              background: authC.green, color: authC.onGreen, font: `700 15px/1 ${font.ui}`,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {t('auth.useDemo')}
          </button>
          <div style={{ font: `400 11.5px/1.45 ${font.ui}`, color: authC.text2, marginTop: 10 }}>{t('auth.demoHint')}</div>
        </div>
        </>)}

        <div style={{ flex: 1, minHeight: 18 }} />

        <div style={{ textAlign: 'center', font: `500 13px/1 ${font.ui}`, color: authC.text2 }}>
          {t('auth.noAccount')} <LinkText onClick={() => navigate('/signup')}>{t('auth.signUp')}</LinkText>
        </div>
      </div>
    </AuthPage>
  );
}

function DemoRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span style={{ flex: 'none', width: 78, font: `500 12px/1.3 ${font.ui}`, color: authC.text2 }}>{label}</span>
      <span style={{ flex: 1, font: `600 13.5px/1.3 ${font.mono}`, color: authC.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`} style={{ flex: 'none', border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex' }}>
        <Icon name={copied ? 'check' : 'share'} size={15} color={copied ? authC.success : authC.green} strokeWidth={2.2} />
      </button>
    </div>
  );
}
