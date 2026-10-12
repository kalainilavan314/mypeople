import type { NicInfo } from '@/core/lib/nic';
import { NameHint } from '@/features/auth/components/NameHint';
import { NicHint } from '@/features/auth/components/NicHint';
import { Field, FieldLabel, GreenButton } from '@/features/auth/components/parts';
import { PasswordHint } from '@/features/auth/components/PasswordHint';
import { Icon } from '@/shared/components/Icon';
import { Logo } from '@/shared/components/Logo';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  t: TFunction<'translation', undefined>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  touched: boolean;
  nic: string;
  setNic: Dispatch<SetStateAction<string>>;
  nicInfo: NicInfo;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  toNicReview: () => void;
  navigate: ReturnType<typeof useNavigate>;
};
export function RegisterFields({
  t,
  name,
  setName,
  touched,
  nic,
  setNic,
  nicInfo,
  password,
  setPassword,
  toNicReview,
  navigate,
}: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 4,
          marginBottom: 18,
        }}
      >
        <Logo size={46} style={{ borderRadius: 12 }} />
        <div>
          <div
            style={{
              font: `800 23px/1.15 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#14263D',
              letterSpacing: 'normal',
            }}
          >
            {t('brand.nameTa')}
          </div>
          <div
            style={{
              font: `700 13.5px/1.2 var(--font-ui, 'Inter', sans-serif)`,
              color: '#2563EB',
              marginTop: 3,
            }}
          >
            {t('brand.name')}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            font: `900 26px/1.25 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#14263D',
            margin: 0,
            letterSpacing: 'normal',
          }}
        >
          {t('auth.createTitle')}
        </h1>
      </div>

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

      <GreenButton onClick={toNicReview}>
        <span
          style={{
            font: `800 16px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            letterSpacing: 'normal',
          }}
        >
          {t('common.next')}
        </span>
        <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
      </GreenButton>

      <div
        style={{
          textAlign: 'center',
          marginTop: 18,
          font: `500 13.5px/1.4 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: '#475569',
          letterSpacing: 'normal',
        }}
      >
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
  );
}
