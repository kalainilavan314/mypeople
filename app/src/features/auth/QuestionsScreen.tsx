import { ApiError, authApi } from '@/core/api/authApi';
import embeddedStyles0 from '@/core/theme/embedded/QuestionsScreen.css?inline';
import { QuestionsQuestionCardContainer } from '@/features/auth/components/QuestionsQuestionCardContainer';
import { QUESTIONS } from '@/features/auth/Questions.model';
import { signupDraft } from '@/features/auth/state/signupDraft';
import { useAuth } from '@/shared/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function Questions() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

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

    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      if (step === total - 1) void finish(next);
      else setStep((s) => s + 1);
    }, 320);
  };

  const advance = () => {
    if (isLast) {
      void finish(answers);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = (to: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setStep(Math.max(0, to));
  };

  const selectedVal = answers[q.id];

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{embeddedStyles0}</style>

      <QuestionsQuestionCardContainer
        step={step}
        navigate={navigate}
        goBack={goBack}
        finish={finish}
        answers={answers}
        t={t}
        total={total}
        q={q}
        selectedVal={selectedVal}
        i18n={i18n}
        choose={choose}
        error={error}
        advance={advance}
        busy={busy}
        isLast={isLast}
      />
    </div>
  );
}
