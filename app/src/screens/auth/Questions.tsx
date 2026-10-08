import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { radius } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { BackChip } from './parts';
import { useAuth } from '../../state/auth';
import { signupDraft } from '../../state/signupDraft';
import { authApi, ApiError } from '../../data/authApi';

interface SurveyQuestion {
  id: string;
  options: string[];
  layout: 'pair' | 'grid';
}

const QUESTIONS: SurveyQuestion[] = [
  { id: 'alcohol', options: ['yes', 'no'], layout: 'pair' },
  { id: 'betel', options: ['yes', 'no'], layout: 'pair' },
  { id: 'marital', options: ['married', 'single'], layout: 'pair' },
  { id: 'blood_group', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], layout: 'grid' },
];

export function Questions() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = QUESTIONS.length;
  const q = QUESTIONS[step];
  const isLast = step === total - 1;

  const finish = async (finalAnswers: Record<string, string>) => {
    if (busy) return;
    const d = signupDraft.patch({ answers: finalAnswers });
    setBusy(true);
    setError(null);
    try {
      await authApi.signup({
        name: d.name,
        nic: d.nic,
        phone: d.phone,
        password: d.password,
        dob: d.dob,
        gender: d.gender,
        districtCode: d.districtCode,
        dsCode: d.dsCode,
        gsCode: d.gsCode,
        referralId: d.referralId,
        answers: d.answers,
        language: i18n.language === 'ta' ? 'ta' : 'en',
        inviteCode: d.inviteCode,
      });
      signupDraft.reset();
      login();
      navigate('/', { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'network';
      setError(
        code === 'nic_exists'
          ? t('questions.errNic', 'இந்த தே.அ.அட்டை எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது.')
          : code === 'phone_exists'
            ? t('questions.errPhone', 'இந்த கைபேசி எண் ஏற்கனவே பயன்பாட்டில் உள்ளது.')
            : code === 'weak_password' || code === 'password_too_long'
              ? t('auth.passwordRule')
              : t('auth.errNetwork'),
      );
      setBusy(false);
    }
  };

  const choose = (val: string) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
  };

  const advance = () => {
    if (isLast) {
      void finish(answers);
    } else {
      setStep((s) => s + 1);
    }
  };

  const selectedVal = answers[q.id];

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
        .question-card-container {
          position: relative;
          width: 100%;
          max-width: 440px;
          min-height: min(100vh - 32px, 860px);
          background: #FFFFFF;
          border-radius: 36px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(16, 45, 85, 0.12), 0 2px 10px rgba(16, 45, 85, 0.04);
          display: flex;
          flex-direction: column;
        }
        .question-bottom-art {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 240px;
          object-fit: cover;
          object-position: center bottom;
          opacity: 0.85;
          pointer-events: none;
          z-index: 0;
          mask-image: linear-gradient(to top, black 40%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, black 40%, transparent 100%);
        }
        .question-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 18px 22px calc(24px + var(--safe-bottom, 0px));
        }
        .question-pair-card {
          flex: 1;
          min-height: 110px;
          border-radius: 20px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 12px;
          transition: all 160ms ease;
          box-shadow: 0 2px 8px rgba(20, 38, 61, 0.03);
        }
        .question-pair-card.active {
          border: 2px solid #2563EB;
          background: #FFFFFF;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.12);
        }
        .question-pair-card:active {
          transform: scale(0.98);
        }
        .question-radio-outer {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #CBD5E1;
          display: grid;
          place-items: center;
          transition: all 160ms ease;
        }
        .question-radio-outer.active {
          border-color: #2563EB;
          background: #EFF6FF;
        }
        .question-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #2563EB;
        }
        .question-grid-card {
          height: 54px;
          border-radius: 14px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          color: #14263D;
          font: 700 16px/1 var(--font-ui, sans-serif);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 140ms ease;
        }
        .question-grid-card.active {
          border-color: #2563EB;
          background: #14263D;
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(20, 38, 61, 0.25);
        }
        .question-cta-btn {
          flex: 1;
          height: 52px;
          border-radius: 999px;
          border: none;
          background: #14263D;
          color: #ffffff;
          font: 800 16px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif);
          letter-spacing: normal;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 24px -4px rgba(20, 38, 61, 0.42);
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .question-cta-btn:active {
          transform: scale(0.98);
        }
        .question-cta-btn:disabled {
          background: #94A3B8;
          opacity: 0.65;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>

      <div className="question-card-container">
        {/* Serene Lower Coastal & Temple Landscape Artwork */}
        <img src="/signup-bg.png" alt="" className="question-bottom-art" aria-hidden="true" />

        <div className="question-content">
          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <BackChip onClick={() => (step === 0 ? navigate('/signup/profile') : setStep((s) => s - 1))} />
            <button
              type="button"
              onClick={() => void finish(answers)}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 8px',
                cursor: 'pointer',
                font: `700 14px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#14263D',
                letterSpacing: 'normal',
              }}
            >
              {t('questions.skipSurvey', 'கணிப்பைத் தவிர்')}
            </button>
          </div>

          {/* Step Tracker Row: Left "1/4", Right numbered step bubbles */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ font: `700 14px/1 var(--font-ui, sans-serif)`, color: '#14263D' }}>
              {step + 1}/{total}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: total }, (_, i) => {
                const active = i === step;
                const done = i < step;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: active ? '#14263D' : done ? '#2563EB' : '#F1F5F9',
                        color: active || done ? '#ffffff' : '#64748B',
                        font: '700 11px/22px var(--font-ui, sans-serif)',
                        display: 'grid',
                        placeItems: 'center',
                        textAlign: 'center',
                        transition: 'all 200ms ease',
                      }}
                    >
                      {i + 1}
                    </span>
                    {i < total - 1 && (
                      <span
                        style={{
                          width: 14,
                          height: 1.5,
                          background: done ? '#2563EB' : '#E2E8F0',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Chip */}
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: radius.pill,
                font: `700 12.5px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#1D4ED8',
                letterSpacing: 'normal',
              }}
            >
              <Icon name="users" size={14} color="#1D4ED8" strokeWidth={2.4} />
              <span>{t('survey.joiningSurvey', 'இணைவுக் கணிப்பு')}</span>
            </span>
          </div>

          {/* Question Title & Description */}
          <h1
            style={{
              font: `900 27px/1.25 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#14263D',
              margin: '0 0 10px',
              letterSpacing: 'normal',
            }}
          >
            {t(`survey.q.${q.id}`)}
          </h1>
          <p
            style={{
              font: `500 13.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#475569',
              margin: 0,
              letterSpacing: 'normal',
            }}
          >
            {t('survey.privacyNote')}
          </p>

          {/* Options Display */}
          <div style={{ marginTop: 24 }}>
            {q.layout === 'pair' ? (
              <div style={{ display: 'flex', gap: 14 }}>
                {q.options.map((val) => {
                  const active = selectedVal === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => choose(val)}
                      className={`question-pair-card ${active ? 'active' : ''}`}
                    >
                      <div className={`question-radio-outer ${active ? 'active' : ''}`}>
                        {active && <div className="question-radio-inner" />}
                      </div>
                      <span
                        style={{
                          font: `800 18px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                          color: '#14263D',
                          letterSpacing: 'normal',
                        }}
                      >
                        {t(`survey.opt.${val}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {q.options.map((val) => {
                  const active = selectedVal === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => choose(val)}
                      className={`question-grid-card ${active ? 'active' : ''}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: '10px 12px',
                borderRadius: 10,
                background: '#FEF2F2',
                color: '#DC2626',
                font: `500 12.5px/1.4 var(--font-ta, sans-serif)`,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 32 }} />

          {/* Bottom Action Row: Back Button + Navy CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackChip onClick={() => setStep((s) => Math.max(0, s - 1))} />
            <button type="button" className="question-cta-btn" onClick={advance} disabled={busy}>
              <span>{isLast ? t('questions.finish', 'முடிவுசெய்') : t('common.next', 'அடுத்து')}</span>
              <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
            </button>
          </div>

          {/* Sub-Action: Skip This Question */}
          <button
            type="button"
            onClick={advance}
            disabled={busy}
            style={{
              margin: '14px auto 0',
              background: 'none',
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              font: `500 13px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#64748B',
              letterSpacing: 'normal',
            }}
          >
            {isLast ? t('questions.finishWithout', 'பதிலளிக்காமல் முடிக்கவும்') : t('questions.skipQuestion', 'இந்தக் கேள்வியைத் தவிர்')}
          </button>
        </div>
      </div>
    </div>
  );
}
