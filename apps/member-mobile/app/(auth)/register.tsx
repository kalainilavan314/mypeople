import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  Checkbox,
  ChipRow,
  Notice,
  Screen,
  TextField,
  useApiAction,
  useLanguage,
  useSession,
} from '@my-people/mobile-ui';

import { AreaFields, NO_AREA, type AreaChoice } from '@/features/area/AreaFields';
import { accountNumber, IdRouteFields, type IdNumber } from '@/features/auth/IdRouteFields';
import { api } from '@/lib/api';
import { errorMessage, problemsOf } from '@/lib/errors';

type Gender = 'male' | 'female' | 'other' | 'skip';

const STEPS = 3;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Where each refused field lives, so a refusal opens the step that needs fixing.
const STEP_OF_PROBLEM: Record<string, number> = {
  invalid_id_number: 1,
  invalid_passport_country: 1,
  invalid_name: 1,
  dob_in_future: 2,
  dob_too_early: 2,
  under_minimum_age: 2,
  area_incomplete: 2,
  unknown_area: 2,
};

/**
 * A03: the ID route and number with the name as on the ID, then optional
 * details and the area, then the password and terms. The API checks
 * everything again and names each problem (FR-AUTH-010 to 013, BR-016, 017).
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { start } = useSession();
  const [step, setStep] = useState(1);
  const [id, setId] = useState<IdNumber>({ route: 'nic', number: '', country: '' });
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('skip');
  const [area, setArea] = useState<AreaChoice>(NO_AREA);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referral, setReferral] = useState('');
  const [accepted, setAccepted] = useState(false);

  const submit = useApiAction(async () => {
    const account = accountNumber(id);
    const result = await api()
      .register({
      fullName: fullName.trim(),
      route: id.route,
      idNumber: 'nic' in account ? account.nic : account.passportNumber,
      passportCountry: 'nic' in account ? null : account.passportCountry,
      password,
      acceptTerms: true,
      language,
      dob: dob || null,
      gender: gender === 'skip' ? null : gender,
      districtCode: area.district,
      dsCode: area.ds,
      gsCode: area.gn,
      referralCode: referral.trim() || null,
      surveyAnswers: {}, // the optional survey is offered later, never required (BR-019)
      })
      .catch((error: unknown) => {
        const steps = problemsOf(error).map((code) => STEP_OF_PROBLEM[code] ?? STEPS);
        if (steps.length > 0) setStep(Math.min(...steps));
        throw error;
      });
    await start(result);
  });

  const problems = problemsOf(submit.error);
  const problem = (...codes: string[]) => {
    const found = problems.find((code) => codes.includes(code));
    return found ? t(`m.problems.${found}`) : null;
  };
  const dobInvalid = dob !== '' && !DATE.test(dob);
  const canLeave = {
    1: id.number.trim() !== '' && fullName.trim() !== '' && (id.route === 'nic' || id.country.length === 3),
    2: !dobInvalid,
    3: password.length >= 10 && password === confirm && accepted,
  }[step as 1 | 2 | 3];

  return (
    <Screen edges={['bottom']}>
      <AppText step="label" tone="muted" accessibilityLiveRegion="polite">
        {t('m.register.step', { step, total: STEPS })}
      </AppText>

      {step === 1 ? (
        <View style={styles.group}>
          <AppText step="section" accessibilityRole="header">
            {t('m.register.routeTitle')}
          </AppText>
          <IdRouteFields
            value={id}
            onChange={setId}
            error={problem('invalid_id_number', 'invalid_passport_country')}
          />
          <TextField
            label={t('m.register.nameLabel')}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            error={problem('invalid_name')}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.group}>
          <TextField
            label={t('m.register.dobLabel')}
            hint={t('m.register.dobHint')}
            optional
            value={dob}
            onChangeText={setDob}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={dobInvalid ? t('m.register.dobHint') : problem('dob_in_future', 'dob_too_early', 'under_minimum_age')}
          />
          <AppText step="label">{t('m.register.genderLabel')}</AppText>
          <ChipRow
            label={t('m.register.genderLabel')}
            selected={gender}
            onSelect={setGender}
            options={[
              { key: 'skip', label: t('m.register.genderSkip') },
              { key: 'female', label: t('m.register.genderFemale') },
              { key: 'male', label: t('m.register.genderMale') },
              { key: 'other', label: t('m.register.genderOther') },
            ]}
          />
          <AppText step="section" accessibilityRole="header">
            {t('m.register.areaTitle')}
          </AppText>
          <AppText step="secondary" tone="muted">
            {t('m.register.areaHint')}
          </AppText>
          <AreaFields value={area} onChange={setArea} error={problem('area_incomplete', 'unknown_area')} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.group}>
          <AppText step="section" accessibilityRole="header">
            {t('m.register.passwordTitle')}
          </AppText>
          <TextField
            label={t('m.signIn.passwordLabel')}
            hint={t('m.register.passwordHint')}
            value={password}
            onChangeText={setPassword}
            secret
            autoComplete="new-password"
            textContentType="newPassword"
            error={problem('password_too_short', 'password_too_long', 'password_too_common', 'password_contains_id_number')}
          />
          <TextField
            label={t('m.register.confirmLabel')}
            value={confirm}
            onChangeText={setConfirm}
            secret
            autoComplete="new-password"
            error={confirm !== '' && confirm !== password ? t('m.register.mismatch') : null}
          />
          <TextField
            label={t('m.register.referralLabel')}
            optional
            value={referral}
            onChangeText={setReferral}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Checkbox label={t('m.register.terms')} checked={accepted} onChange={setAccepted} />
        </View>
      ) : null}

      {submit.error && problems.length === 0 ? <Notice tone="error">{errorMessage(t, submit.error)}</Notice> : null}
      {problems.length > 0 ? <Notice tone="error">{t('m.errors.registration_refused')}</Notice> : null}

      <View style={styles.actions}>
        {step < STEPS ? (
          <Button label={t('m.common.continue')} disabled={!canLeave} onPress={() => setStep(step + 1)} />
        ) : (
          <Button
            label={t('m.register.submit')}
            busy={submit.busy}
            busyLabel={t('m.common.sending')}
            disabled={!canLeave}
            onPress={() => void submit.run()}
          />
        )}
        {step > 1 ? <Button label={t('m.common.back')} variant="secondary" onPress={() => setStep(step - 1)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[3] },
  actions: { gap: spacing[3] },
});
