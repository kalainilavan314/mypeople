import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font, radius } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { signupDraft } from '../../state/signupDraft';
import { parseNic, formatDob } from '../../lib/nic';
import { compressImage } from '../../lib/image';
import { Field, FieldLabel, GreenButton, LangToggle, Steps, BackChip } from './parts';

type Step = 0 | 1;

export function SignUp() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [nicFrontPhoto, setNicFrontPhoto] = useState<string | null>(signupDraft.get().nicFrontPhoto);
  const [nicBackPhoto, setNicBackPhoto] = useState<string | null>(signupDraft.get().nicBackPhoto);
  const [photosTouched, setPhotosTouched] = useState(false);

  const nicInfo = useMemo(() => parseNic(nic), [nic]);

  const back = () => {
    if (step === 0) navigate('/login');
    else setStep(0);
  };

  const toNicReview = () => {
    setTouched(true);
    if (name.trim().length < 2) return;
    if (!nicInfo.valid) return;
    if (password.length < 6) return;
    signupDraft.patch({
      name: name.trim(),
      nic: nicInfo.normalized,
      phone: '',
      password,
      dob: nicInfo.dob ? nicInfo.dob.toISOString().slice(0, 10) : '',
    });
    setStep(1);
  };

  return (
    <div
      style={{
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        background: '#EDF4FC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 12px calc(10px + var(--safe-bottom, 0px))',
      }}
    >
      <style>{`
        .signup-card-container {
          position: relative;
          width: 100%;
          max-width: 440px;
          height: 100%;
          max-height: 100%;
          background: #ffffff;
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(16, 45, 85, 0.12), 0 2px 10px rgba(16, 45, 85, 0.04);
          display: flex;
          flex-direction: column;
        }
        .signup-bg-art {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          pointer-events: none;
          z-index: 0;
          opacity: 0.95;
        }
        .signup-bg-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(255, 255, 255, 0.76) 16%,
            rgba(255, 255, 255, 0.92) 32%,
            rgba(255, 255, 255, 0.92) 76%,
            rgba(255, 255, 255, 0.45) 92%,
            rgba(255, 255, 255, 0.15) 100%
          );
          pointer-events: none;
          z-index: 1;
        }
        .signup-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 14px 22px calc(16px + var(--safe-bottom, 0px));
        }
        .signup-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
      `}</style>

      <div className="signup-card-container">
        {/* Full Scenic Coastal Background */}
        <img
          src="/signup-bg.png"
          alt=""
          className="signup-bg-art"
          aria-hidden="true"
        />
        {/* Soft readable overlay keeping top lighthouse & bottom boats visible */}
        <div className="signup-bg-overlay" aria-hidden="true" />

        <div className="signup-content">
          {/* Top bar with back, steps, and lang switcher */}
          <div className="signup-topbar">
            <BackChip onClick={back} />
            <Steps step={step} total={3} />
            <LangToggle />
          </div>

          {step === 0 && (
            <>
              {/* Brand Logo and Name Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 18 }}>
                <Logo size={46} style={{ borderRadius: 12 }} />
                <div>
                  <div style={{ font: `800 23px/1.15 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', letterSpacing: 'normal' }}>
                    {t('brand.nameTa')}
                  </div>
                  <div style={{ font: `700 13.5px/1.2 var(--font-ui, 'Inter', sans-serif)`, color: '#2563EB', marginTop: 3 }}>
                    {t('brand.name')}
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ font: `900 26px/1.25 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', margin: 0, letterSpacing: 'normal' }}>
                  {t('auth.createTitle')}
                </h1>
              </div>

              {/* Field 1: Full Name */}
              <div style={{ marginTop: 6 }}>
                <FieldLabel ta={t('auth.nameLabel')} en="Full name" />
                <Field
                  icon="user"
                  value={name}
                  onChange={setName}
                  placeholder={t('auth.namePlaceholder')}
                  autoCapitalize="words"
                  error={touched && name.trim().length < 2}
                  ariaLabel={t('auth.nameLabel')}
                />
                <NameHint name={name} touched={touched} />
              </div>

              {/* Field 2: NIC */}
              <div style={{ marginTop: 20 }}>
                <FieldLabel ta={t('auth.nicLabel')} en="NIC number" />
                <Field
                  icon="idCard"
                  value={nic}
                  onChange={(v) => setNic(v.toUpperCase())}
                  placeholder="199512345678 / 951234567V"
                  autoCapitalize="characters"
                  maxLength={12}
                  error={touched && !nicInfo.valid}
                  ariaLabel={t('auth.nicLabel')}
                />
                <NicHint info={nicInfo} touched={touched} />
              </div>

              {/* Field 3: Password */}
              <div style={{ marginTop: 20 }}>
                <FieldLabel ta={t('auth.passwordLabel')} en="Password" />
                <Field
                  icon="lock"
                  value={password}
                  onChange={setPassword}
                  placeholder={t('auth.passwordHint')}
                  password
                  error={touched && password.length < 6}
                  ariaLabel={t('auth.passwordLabel')}
                />
                <PasswordHint password={password} touched={touched} />
              </div>

              <div style={{ flex: 1, minHeight: 28 }} />

              {/* Primary Next Action Button */}
              <GreenButton onClick={toNicReview}>
                <span style={{ font: `800 16px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, letterSpacing: 'normal' }}>
                  {t('common.next')}
                </span>
                <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
              </GreenButton>

              {/* Footer Login Link */}
              <div style={{ textAlign: 'center', marginTop: 18, font: `500 13.5px/1.4 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#475569', letterSpacing: 'normal' }}>
                {t('auth.haveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#14263D',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    font: 'inherit',
                  }}
                >
                  {t('auth.login')}
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ marginBottom: 18 }}>
                <h1 style={{ font: `900 25px/1.25 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', margin: 0, letterSpacing: 'normal' }}>
                  {t('auth.verifyNicTitle')}
                </h1>
                <p style={{ font: `500 13.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#475569', margin: '8px 0 0', letterSpacing: 'normal' }}>
                  {t('auth.verifyNicSub')}
                </p>
              </div>

              <NicCard info={nicInfo} />

              <div style={{ marginTop: 18 }}>
                <FieldLabel ta={t('auth.nicPhotosTitle')} />
                <p style={{ font: `400 12.5px/1.5 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#64748B', margin: '0 0 10px' }}>
                  {t('auth.nicPhotosSub')}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <NicPhotoTile
                    label={t('auth.nicPhotoFront')}
                    photo={nicFrontPhoto}
                    onPick={(photo) => setNicFrontPhoto(photo)}
                  />
                  <NicPhotoTile
                    label={t('auth.nicPhotoBack')}
                    photo={nicBackPhoto}
                    onPick={(photo) => setNicBackPhoto(photo)}
                  />
                </div>
                {photosTouched && (!nicFrontPhoto || !nicBackPhoto) && (
                  <div style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8 }}>{t('auth.errNicPhotos')}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: '12px 14px', borderRadius: radius.md, background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                <Icon name="shield" size={18} color="#2563EB" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ font: `400 12.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B', letterSpacing: 'normal', whiteSpace: 'pre-line' }}>
                  {t('auth.verifyNicNote')}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 24 }} />

              <GreenButton
                onClick={() => {
                  setPhotosTouched(true);
                  if (!nicFrontPhoto || !nicBackPhoto) return;
                  signupDraft.patch({ nicFrontPhoto, nicBackPhoto });
                  navigate('/signup/profile');
                }}
              >
                <span style={{ font: `800 16px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, letterSpacing: 'normal' }}>
                  {t('auth.verifyFinish')}
                </span>
                <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
              </GreenButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordHint({ password, touched }: { password: string; touched: boolean }) {
  const { t } = useTranslation();
  const isError = touched && password.length < 6;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, color: isError ? authC.error : '#475569' }}>
      <Icon name="shield" size={16} color={isError ? authC.error : '#64748B'} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ font: `400 12.5px/1.45 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: isError ? authC.error : '#475569', letterSpacing: 'normal' }}>
        {t('auth.passwordRule')}
      </div>
    </div>
  );
}

function NameHint({ name, touched }: { name: string; touched: boolean }) {
  const { t } = useTranslation();
  if (!touched || name.trim().length >= 2) return null;
  return <div style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8, marginBottom: 2 }}>{t('auth.errName')}</div>;
}

function NicHint({ info, touched }: { info: ReturnType<typeof parseNic>; touched: boolean }) {
  const { t } = useTranslation();
  if (!touched || info.valid) return null;
  return <div style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8, marginBottom: 2 }}>{t('auth.errNic')}</div>;
}

function NicPhotoTile({
  label,
  photo,
  onPick,
}: {
  label: string;
  photo: string | null;
  onPick: (dataUrl: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onPick(await compressImage(file));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={photo ? `${t('auth.nicPhotoRetake')} — ${label}` : `${t('auth.nicPhotoAdd')} — ${label}`}
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          borderRadius: radius.md,
          border: photo ? `1.5px solid #E2E8F0` : '1.5px dashed #94A3B8',
          background: photo ? `center / cover no-repeat url(${photo})` : '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: busy ? 'default' : 'pointer',
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!photo && (
          <>
            <Icon name="camera" size={22} color="#64748B" strokeWidth={1.8} />
            <span style={{ font: `600 11.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#64748B' }}>
              {busy ? '…' : t('auth.nicPhotoAdd')}
            </span>
          </>
        )}
        {photo && (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(15,23,42,0.72)',
              color: '#fff',
              font: `600 10.5px/1.4 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            }}
          >
            {t('auth.nicPhotoRetake')}
          </span>
        )}
      </button>
      <div style={{ font: `500 11.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#475569', marginTop: 6, textAlign: 'center' }}>
        {label}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
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
    <div style={{ borderRadius: radius.lg, background: '#FFFFFF', border: `1.5px solid #E2E8F0`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(20,38,61,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid #E2E8F0` }}>
        <Icon name="idCard" size={20} color="#14263D" />
        <span style={{ font: `700 14px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', letterSpacing: 'normal' }}>
          {t('auth.nicDetails')}
        </span>
      </div>
      <div style={{ padding: '6px 16px 12px' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: `1px solid #F1F5F9` }}>
            <span style={{ font: `500 13px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#64748B', letterSpacing: 'normal' }}>{k}</span>
            <span style={{ font: `600 13px/1.3 ${font.mono}`, color: '#14263D', textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
