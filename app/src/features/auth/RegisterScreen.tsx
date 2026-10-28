import { parseNic } from '@/core/lib/nic';
import embeddedStyles0 from '@/core/theme/embedded/RegisterScreen.css?inline';
import { BackChip, LangToggle, Steps } from '@/features/auth/components/parts';
import { RegisterFields } from '@/features/auth/components/RegisterFields';
import { RegisterNicReview } from '@/features/auth/components/RegisterNicReview';
import { Step } from '@/features/auth/Register.model';
import { signupDraft } from '@/features/auth/state/signupDraft';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function SignUp() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

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
      <style>{embeddedStyles0}</style>

      <div className="signup-card-container">
        <img src="/signup-bg.png" alt="" className="signup-bg-art" aria-hidden="true" />

        <div className="signup-bg-overlay" aria-hidden="true" />

        <div className="signup-content">
          <div className="signup-topbar">
            <BackChip onClick={back} />
            <Steps step={step} total={4} />
            <LangToggle />
          </div>

          {step === 0 && (
            <RegisterFields
              t={t}
              name={name}
              setName={setName}
              touched={touched}
              nic={nic}
              setNic={setNic}
              nicInfo={nicInfo}
              password={password}
              setPassword={setPassword}
              toNicReview={toNicReview}
              navigate={navigate}
            />
          )}

          {step === 1 && (
            <RegisterNicReview t={t} nicInfo={nicInfo} navigate={navigate} />
          )}
        </div>
      </div>
    </div>
  );
}
