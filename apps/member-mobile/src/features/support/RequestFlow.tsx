import type { SupportCategory, SupportHome, SupportRequestInput } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  Notice,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
} from '@my-people/mobile-ui';

import { FieldError } from '@/components/FieldError';
import { AreaFields, NO_AREA, type AreaChoice } from '@/features/area/AreaFields';
import { chosenArea } from '@/features/area/chosenArea';
import { EmergencyNumbers } from '@/features/support/EmergencyNumbers';
import { isSupportCategory, LIMITS, PHONE } from '@/features/support/labels';
import { errorMessage, problemsOf } from '@/lib/errors';

type Step = 'danger' | 'emergency' | 'form';

type Props = {
  contacts: SupportHome['emergencyContacts'];
  categories: SupportCategory[];
  initialCategory: SupportCategory | null;
  /**
   * The public web form, for people without an account: the team can only call back, so a phone is
   * required, and with no profile area to fall back on, at least the district is too.
   */
  publicForm?: boolean;
  /** Sends the request; the caller shows what comes next. */
  onSend: (input: SupportRequestInput) => Promise<void>;
};

/**
 * M12 Ask for support, in the app and on the public web form. The first question is whether anyone is
 * in immediate danger; if so, the emergency numbers come again before anything else (FR-AST-003).
 * Nothing is sent without the person's consent to collect the case details (FR-AST-004), and
 * membership, party, donations or voting are never asked about.
 */
export function RequestFlow({ contacts, categories, initialCategory, publicForm = false, onSend }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('danger');
  const [emergency, setEmergency] = useState(false);

  if (step === 'danger') {
    return (
      <View style={styles.body}>
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.support.dangerQuestion')}
          </AppText>
          <Button
            label={t('m.support.dangerYes')}
            variant="danger"
            icon="alert-circle-outline"
            onPress={() => {
              setEmergency(true);
              setStep('emergency');
            }}
          />
          <Button
            label={t('m.support.dangerNo')}
            variant="secondary"
            onPress={() => {
              setEmergency(false);
              setStep('form');
            }}
          />
        </SurfaceCard>
        <AppText step="secondary" tone="secondary">
          {t('m.support.neverDepends')}
        </AppText>
      </View>
    );
  }

  if (step === 'emergency') {
    return (
      <View style={styles.body}>
        <EmergencyNumbers contacts={contacts} lead={t('m.support.emergencyNow')} />
        <Button label={t('m.support.continueRequest')} variant="secondary" icon="arrow-forward" iconAfter onPress={() => setStep('form')} />
      </View>
    );
  }

  return (
    <RequestForm
      categories={categories}
      emergency={emergency}
      initialCategory={initialCategory}
      publicForm={publicForm}
      onSend={onSend}
    />
  );
}

function RequestForm({
  categories,
  emergency,
  initialCategory,
  publicForm,
  onSend,
}: {
  categories: SupportCategory[];
  emergency: boolean;
  initialCategory: SupportCategory | null;
  publicForm: boolean;
  onSend: (input: SupportRequestInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SupportCategory | null>(initialCategory ?? (emergency ? 'emergency_needs' : null));
  const [summary, setSummary] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [household, setHousehold] = useState('');
  const [area, setArea] = useState<AreaChoice>(NO_AREA);
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const send = useApiAction(async () => {
    if (!category) return;
    await onSend({
      category,
      summary: summary.trim(),
      emergency,
      consent,
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      household: household.trim() || null,
      area: chosenArea(area),
    });
  });

  const problems = {
    category: !category,
    summary: summary.trim().length < LIMITS.summaryMin,
    name: fullName.trim().length < LIMITS.nameMin,
    phoneMissing: publicForm && phone.trim() === '',
    phone: phone.trim() !== '' && !PHONE.test(phone.trim()),
    area: publicForm && !area.district,
    consent: !consent,
  };
  const submit = () => {
    if (Object.values(problems).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    void send.run();
  };
  // The in-app words for "unknown_area" point at the profile area, which the public form does not have.
  const failure =
    send.error && publicForm && problemsOf(send.error).includes('unknown_area')
      ? t('m.support.publicUnknownArea')
      : send.error
        ? errorMessage(t, send.error, 'support')
        : null;

  return (
    <View style={styles.body}>
      {emergency ? <Notice tone="warning">{t('m.support.emergencyFlagged')}</Notice> : null}
      <AppText step="body" tone="secondary">
        {t('m.support.formIntro')}
      </AppText>

      <SurfaceCard style={styles.card}>
        <SelectField
          label={t('m.support.category')}
          placeholder={t('m.support.chooseCategory')}
          value={category}
          options={categories.map((key) => ({ value: key, label: t(`m.support.category_${key}`) }))}
          onChange={(value) => setCategory(isSupportCategory(value) ? value : null)}
          error={showErrors && problems.category ? t('m.support.categoryError') : null}
        />
        <TextField
          label={t('m.support.whatHappened')}
          hint={t('m.support.whatHappenedHint', { min: LIMITS.summaryMin })}
          value={summary}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.summaryMax}
          onChangeText={setSummary}
          error={showErrors && problems.summary ? t('m.support.atLeast', { min: LIMITS.summaryMin }) : null}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.support.whoNeedsHelp')}
        </AppText>
        <TextField
          label={t('m.support.name')}
          value={fullName}
          maxLength={LIMITS.nameMax}
          autoComplete="name"
          onChangeText={setFullName}
          error={showErrors && problems.name ? t('m.support.nameError') : null}
        />
        <TextField
          label={t('m.support.phone')}
          hint={publicForm ? t('m.support.phoneHintPublic') : t('m.support.phoneHint')}
          optional={!publicForm}
          value={phone}
          keyboardType="phone-pad"
          maxLength={16}
          onChangeText={setPhone}
          error={
            showErrors && problems.phoneMissing
              ? t('m.support.phoneRequired')
              : showErrors && problems.phone
                ? t('m.support.phoneError')
                : null
          }
        />
        <TextField
          label={t('m.support.household')}
          hint={t('m.support.householdHint')}
          optional
          value={household}
          maxLength={LIMITS.householdMax}
          onChangeText={setHousehold}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.support.area')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {publicForm ? t('m.support.areaHintPublic') : t('m.support.areaHint')}
        </AppText>
        <AreaFields value={area} onChange={setArea} />
        {showErrors && problems.area ? <FieldError text={t('m.support.districtRequired')} /> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Checkbox label={t('m.support.consent')} checked={consent} onChange={setConsent} />
        <AppText step="secondary" tone="muted">
          {t('m.support.consentNote')}
        </AppText>
        {showErrors && problems.consent ? <FieldError text={t('m.support.consentError')} /> : null}
      </SurfaceCard>

      <AppText step="secondary" tone="secondary">
        {t('m.support.neverDepends')}
      </AppText>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <Button label={t('m.support.send')} icon="send-outline" busy={send.busy} disabled={!consent} onPress={submit} />
      {!consent ? (
        <AppText step="secondary" tone="muted">
          {t('m.support.consentError')}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
});
