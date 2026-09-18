import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font, radius } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { signupDraft } from '../../state/signupDraft';
import { authApi } from '../../data/authApi';
import { parseNic, formatDob } from '../../lib/nic';
import { AuthPage, Field, FieldLabel, GreenButton, LangToggle, LinkText, Steps, BackChip } from './parts';

/**
 * Create account — step 1 of 3 in the joining flow:
 *   SignUp (name + NIC + password, NIC decoded & confirmed)
 *     -> /signup/profile   (DOB, gender, District -> DS -> GS, referral)
 *     -> /signup/questions (joining survey; creates the account at the end)
 *
 * There is NO mobile number and NO OTP step: identity is the NIC, validated
 * structurally by lib/nic.ts (format, embedded birth date, gender, age). Official
 * confirmation against the Department for Registration of Persons stays a
 * back-office step — the card below says so rather than implying it's verified.
 */
type Step = 0 | 1;

export function SignUp() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Closed-pilot deployments gate registration behind an invite code. Ask for it
  // here, on the first screen, rather than letting someone fill three screens of
  // profile and survey before the server rejects the whole thing at the end.
  useEffect(() => {
    let live = true;
    authApi.config().then((cfg) => {
      if (live) setInviteRequired(cfg.inviteRequired);
    });
    return () => {
      live = false;
    };
  }, []);

  const nicInfo = useMemo(() => parseNic(nic), [nic]);
  const detailsOk =
    name.trim().length >= 2 &&
    nicInfo.valid &&
    password.length >= 15 &&
    (!inviteRequired || inviteCode.trim().length > 0);

  const back = () => {
    if (step === 0) navigate('/login');
    else setStep(0);
  };

  const toNicReview = () => {
    setTouched(true);
    setError(null);
    if (!detailsOk) {
      if (!nicInfo.valid) setError(t('auth.errNic'));
      else if (password.length < 15) setError(t('auth.passwordRule'));
      return;
    }
    signupDraft.patch({
      name: name.trim(),
      nic: nicInfo.normalized,
      phone: '',
      password,
      inviteCode: inviteCode.trim(),
      // Date of birth is derived from the NIC here — the profile step no longer
      // asks for it again (it is already encoded in the national ID number).
      dob: nicInfo.dob ? nicInfo.dob.toISOString().slice(0, 10) : '',
    });
    setStep(1);
  };

  return (
    <AuthPage>
      {/* Top bar */}
      <div style={{ padding: '18px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <BackChip onClick={back} />
        <Steps step={step} total={3} />
        <LangToggle />
      </div>

      <div style={{ flex: 1, padding: '10px 24px calc(28px + var(--safe-bottom))', display: 'flex', flexDirection: 'column' }}>
        {step === 0 && (
          <>
            <Header title={t('auth.createTitle')} sub={t('auth.createSub')} />

            {inviteRequired && (
              <>
                <FieldLabel ta={t('auth.inviteLabel')} en="Invite code" />
                <Field
                  icon="shield"
                  value={inviteCode}
                  onChange={(v) => setInviteCode(v.toUpperCase())}
                  placeholder={t('auth.invitePlaceholder')}
                  autoCapitalize="characters"
                  ariaLabel={t('auth.inviteLabel')}
                />
                <div style={{ font: `400 11.5px/1.4 ${font.ui}`, color: authC.text3, marginTop: 8 }}>
                  {t('auth.inviteHint')}
                </div>
                <div style={{ height: 16 }} />
              </>
            )}

            <FieldLabel ta={t('auth.nameLabel')} en="Full name" />
            <Field
              icon="user"
              value={name}
              onChange={setName}
              placeholder={t('auth.namePlaceholder')}
              autoCapitalize="words"
              ariaLabel={t('auth.nameLabel')}
            />

            <div style={{ height: 16 }} />
            <FieldLabel ta={t('auth.nicLabel')} en="NIC number" />
            <Field
              icon="idCard"
              value={nic}
              onChange={(v) => setNic(v.toUpperCase())}
              placeholder="199512345678 / 951234567V"
              autoCapitalize="characters"
              maxLength={12}
              error={touched && nic.length > 0 && !nicInfo.valid}
              ariaLabel={t('auth.nicLabel')}
            />
            <NicHint info={nicInfo} touched={touched} />

            <div style={{ height: 16 }} />
            <FieldLabel ta={t('auth.passwordLabel')} en="Password" />
            <Field icon="lock" value={password} onChange={setPassword} placeholder={t('auth.passwordHint')} password ariaLabel={t('auth.passwordLabel')} />
            <div style={{ font: `400 11.5px/1.4 ${font.ui}`, color: authC.text3, marginTop: 8 }}>{t('auth.passwordRule')}</div>

            {error && <ErrorNote text={error} />}
            <div style={{ flex: 1, minHeight: 24 }} />
            <GreenButton onClick={toNicReview} disabled={!detailsOk}>{t('common.next')}</GreenButton>
            <div style={{ textAlign: 'center', marginTop: 18, font: `500 13px/1 ${font.ui}`, color: authC.text3 }}>
              {t('auth.haveAccount')} <LinkText onClick={() => navigate('/login')}>{t('auth.login')}</LinkText>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Header title={t('auth.verifyNicTitle')} sub={t('auth.verifyNicSub')} />
            <NicCard info={nicInfo} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: '12px 14px', borderRadius: radius.md, background: authC.greenSoft, border: `1px solid ${authC.line}` }}>
              <Icon name="shield" size={18} color={authC.green} />
              <div style={{ font: `400 12px/1.5 ${font.ui}`, color: authC.text2 }}>{t('auth.verifyNicNote')}</div>
            </div>
            <div style={{ flex: 1, minHeight: 24 }} />
            <GreenButton onClick={() => navigate('/signup/profile')}>{t('auth.verifyFinish')}</GreenButton>
          </>
        )}
      </div>
    </AuthPage>
  );
}

/* ------------------------------------------------------------------ pieces */

function ErrorNote({ text }: { text: string }) {
  return (
    <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: authC.errorSoft, color: authC.error, font: `500 12.5px/1.4 ${font.ui}` }}>
      {text}
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ font: `800 26px/1.2 ${font.ta}`, margin: 0, color: authC.text, letterSpacing: '-.01em' }}>{title}</h2>
      <div style={{ font: `400 14px/1.5 ${font.ui}`, color: authC.text2, marginTop: 7 }}>{sub}</div>
    </div>
  );
}

function NicHint({ info, touched }: { info: ReturnType<typeof parseNic>; touched: boolean }) {
  const { t } = useTranslation();
  if (info.normalized.length === 0) return null;
  if (!info.valid) {
    if (!touched) return null;
    return <div style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8 }}>{t('auth.errNic')}</div>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
      <Icon name="check" size={14} color={authC.green} strokeWidth={2.6} />
      <span style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.success }}>
        {info.dob && formatDob(info.dob)} · {t(info.gender === 'female' ? 'auth.female' : 'auth.male')} · {t('auth.age', { n: info.age })}
      </span>
    </div>
  );
}

function NicCard({ info }: { info: ReturnType<typeof parseNic> }) {
  const { t } = useTranslation();
  const rows: Array<[string, string]> = info.valid
    ? [
        [t('auth.nicNumber'), info.normalized],
        [t('auth.dob'), info.dob ? formatDob(info.dob) : '—'],
        [t('auth.gender'), t(info.gender === 'female' ? 'auth.female' : 'auth.male')],
        [t('auth.ageLabel'), String(info.age)],
      ]
    : [[t('auth.nicNumber'), info.normalized || '—']];
  return (
    <div style={{ borderRadius: radius.lg, background: authC.surface, border: `1px solid ${authC.line}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${authC.line}` }}>
        <Icon name="idCard" size={20} color={authC.green} />
        <span style={{ font: `700 14px/1 ${font.ui}`, color: authC.text }}>{t('auth.nicDetails')}</span>
      </div>
      <div style={{ padding: '6px 16px 12px' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: `1px solid ${authC.line}` }}>
            <span style={{ font: `400 13px/1.3 ${font.ui}`, color: authC.text3 }}>{k}</span>
            <span style={{ font: `600 13px/1.3 ${font.mono}`, color: authC.text, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
