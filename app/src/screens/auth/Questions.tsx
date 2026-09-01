import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font, radius } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { AuthPage, Steps } from './parts';
import { useAuth } from '../../state/auth';
import { signupDraft } from '../../state/signupDraft';
import { authApi, ApiError } from '../../data/authApi';

/**
 * Joining survey. Answers are written to npm.onboarding_answer on the backend
 * (see server/src/index.js signup) and read back via the npm.member_survey view.
 *
 * `id` is the question_id stored in the database — keep these stable, reports
 * key off them. `options` are the stored answer values; their labels come from
 * i18n (`survey.opt.<value>`) so the survey renders in the member's language.
 */
interface SurveyQuestion {
  id: string;
  options: string[];
  /** 'pair' = two wide buttons side by side; 'grid' = 4-per-row chips. */
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
  const answered = answers[q.id] != null;

  // Final step: create the account with the whole profile + survey.
  const finish = async (finalAnswers: Record<string, string>) => {
    if (busy) return;
    const d = signupDraft.patch({ answers: finalAnswers });
    setBusy(true);
    setError(null);
    try {
      await authApi.signup({
        name: d.name, nic: d.nic, phone: d.phone, password: d.password,
        dob: d.dob, gender: d.gender,
        districtCode: d.districtCode, dsCode: d.dsCode, gsCode: d.gsCode,
        referralId: d.referralId, answers: d.answers,
        language: i18n.language === 'ta' ? 'ta' : 'en',
        inviteCode: d.inviteCode,
      });
      signupDraft.reset();
      login();
      navigate('/', { replace: true });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'network';
      setError(
        code === 'nic_exists' ? t('questions.errNic')
          : code === 'phone_exists' ? t('questions.errPhone')
            : code === 'invalid_invite_code' ? t('auth.errInvite')
              : t('auth.errNetwork'),
      );
      setBusy(false);
    }
  };

  const choose = (val: string) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
    // Auto-advance so the survey feels quick; the last answer submits.
    if (!isLast) setTimeout(() => setStep((s) => s + 1), 170);
    else setTimeout(() => void finish(next), 170);
  };

  const advance = () => (isLast ? void finish(answers) : setStep((s) => s + 1));

  return (
    <AuthPage>
      <div style={{ padding: '18px 22px 6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ font: `600 13px/1 ${font.ui}`, color: authC.text2 }}>{step + 1}/{total}</span>
          <button
            type="button"
            onClick={() => void finish(answers)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', font: `600 13px/1 ${font.ui}`, color: authC.text3 }}
          >
            {t('questions.skipAll')}
          </button>
        </div>
        <Steps step={step + 1} total={total} />
      </div>

      <div style={{ flex: 1, padding: '24px 22px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ font: `700 12px/1 ${font.ui}`, letterSpacing: '.12em', textTransform: 'uppercase', color: authC.green, marginBottom: 12 }}>
          {t('survey.joiningSurvey')}
        </div>
        <h1 style={{ font: `800 25px/1.35 ${i18n.language === 'ta' ? font.ta : font.head}`, color: authC.text, margin: 0 }}>
          {t(`survey.q.${q.id}`)}
        </h1>
        <p style={{ font: `400 13.5px/1.5 ${font.ui}`, color: authC.text2, margin: '10px 0 0' }}>{t('survey.privacyNote')}</p>

        {q.layout === 'pair' ? (
          <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
            {q.options.map((val) => (
              <button key={val} type="button" onClick={() => choose(val)} style={pairStyle(answers[q.id] === val, i18n.language === 'ta')}>
                {t(`survey.opt.${val}`)}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 26 }}>
            {q.options.map((val) => (
              <button key={val} type="button" onClick={() => choose(val)} style={gridStyle(answers[q.id] === val)}>
                {val}
              </button>
            ))}
          </div>
        )}

        {busy && <div style={{ marginTop: 20, font: `600 13px/1 ${font.ui}`, color: authC.green }}>{t('questions.creating')}</div>}
        {error && (
          <div role="alert" style={{ marginTop: 16, padding: '10px 12px', borderRadius: 10, background: authC.errorSoft, color: authC.error, font: `500 12.5px/1.4 ${font.ui}` }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 20 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={navBtn(step === 0)}>
            <Icon name="chevronLeft" size={22} color={step === 0 ? authC.text3 : authC.text} />
          </button>
          <button type="button" onClick={advance} style={{ background: 'none', border: 'none', cursor: 'pointer', font: `600 15px/1 ${font.ui}`, color: authC.text2 }}>
            {t('common.skip')}
          </button>
          <button
            type="button"
            onClick={advance}
            aria-label={isLast ? t('questions.finish') : t('common.next')}
            style={{ ...navBtn(false), background: answered ? authC.greenGrad : authC.surface2, border: answered ? 'none' : `1px solid ${authC.line}`, boxShadow: answered ? authC.greenGlow : 'none' }}
          >
            <Icon name={isLast ? 'check' : 'chevron'} size={22} color={answered ? authC.onGreen : authC.text3} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </AuthPage>
  );
}

function pairStyle(active: boolean, tamil: boolean): CSSProperties {
  return {
    flex: 1, minHeight: 60, padding: '0 12px', borderRadius: radius.md, cursor: 'pointer',
    border: `1.5px solid ${active ? authC.green : authC.fieldBorder}`,
    background: active ? authC.greenSoft : authC.surface,
    color: active ? authC.green : authC.text,
    font: `600 16px/1.3 ${tamil ? font.ta : font.ui}`,
  };
}

function gridStyle(active: boolean): CSSProperties {
  return {
    height: 56, borderRadius: radius.md, cursor: 'pointer',
    border: `1.5px solid ${active ? authC.green : authC.fieldBorder}`,
    background: active ? authC.green : authC.surface,
    color: active ? authC.onGreen : authC.text,
    font: `700 16px/1 ${font.ui}`,
  };
}

function navBtn(disabled: boolean): CSSProperties {
  return {
    width: 52, height: 52, borderRadius: radius.pill, border: `1px solid ${authC.line}`,
    background: authC.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
  };
}
