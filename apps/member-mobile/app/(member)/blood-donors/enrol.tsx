import type { BloodContactMethod, BloodDonorHome, BloodGroup } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  ChipRow,
  Notice,
  Screen,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useMember,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { BroadAreaFields, type BroadArea } from '@/features/bloodDonors/BroadAreaFields';
import {
  AVAILABILITY,
  availabilityOf,
  availabilityValues,
  CONTACT_METHODS,
  DONOR_LIMITS,
  type Availability,
} from '@/features/bloodDonors/labels';
import { PHONE } from '@/features/support/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** M37: opt in as a blood donor, or change the details. Consent is given again every time (FR-BLD-001). */
export default function DonorEnrolScreen() {
  const home = useApiQuery(() => api().getMyBloodDonor());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="bloodDonors" query={home}>
        {(data) => <DonorForm data={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

/** The saved broad area, or the member's own district for a first enrolment. */
function areaFrom(donor: BloodDonorHome['donor'], memberDistrict: string | null): BroadArea {
  if (!donor) return { district: memberDistrict, ds: null };
  const district = donor.districtKey.startsWith('district:') ? donor.districtKey.slice('district:'.length) : memberDistrict;
  return { district, ds: donor.areaKey.startsWith('ds:') ? donor.areaKey.slice('ds:'.length) : null };
}

function DonorForm({ data }: { data: BloodDonorHome }) {
  const { t } = useTranslation();
  const member = useMember();
  const donor = data.donor;
  const [group, setGroup] = useState<BloodGroup | null>(donor?.bloodGroup ?? null);
  const [area, setArea] = useState<BroadArea>(() => areaFrom(donor, member.districtCode));
  const [name, setName] = useState(donor?.contactName ?? member.fullName);
  const [phone, setPhone] = useState(donor?.contactPhone ?? member.phone ?? '');
  const [methods, setMethods] = useState<BloodContactMethod[]>(donor?.contactMethods ?? ['call']);
  const [availability, setAvailability] = useState<Availability>(
    donor ? availabilityOf(donor.available, donor.pausedUntil) : 'now',
  );
  const [availabilityChanged, setAvailabilityChanged] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const problems = {
    group: !group,
    area: !area.district,
    name: name.trim().length < DONOR_LIMITS.nameMin,
    phone: !PHONE.test(phone.trim()),
    methods: methods.length === 0,
    consent: !consent,
  };
  const save = useApiAction(async () => {
    if (!group || !area.district) return;
    // An unchanged pause keeps its date instead of starting again from today.
    const keep = donor && !availabilityChanged;
    const values = keep ? { available: donor.available, pausedUntil: donor.pausedUntil } : availabilityValues(availability);
    await api().saveMyBloodDonor({
      bloodGroup: group,
      area: area.ds ? { level: 'ds', code: area.ds } : { level: 'district', code: area.district },
      contactName: name.trim(),
      contactPhone: phone.trim(),
      contactMethods: methods,
      ...values,
      consent,
    });
    router.back();
  });
  const submit = () => {
    if (Object.values(problems).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    void save.run();
  };
  const toggle = (method: BloodContactMethod, on: boolean) =>
    setMethods((current) => (on ? [...current, method] : current.filter((item) => item !== method)));

  return (
    <View style={styles.body}>
      <Notice tone="info" title={t('m.bloodDonors.medicalTitle')}>
        {t('m.bloodDonors.medicalStatement')}
      </Notice>
      <SurfaceCard style={styles.card}>
        <SelectField
          label={t('m.bloodDonors.bloodGroup')}
          placeholder={t('m.bloodDonors.chooseGroup')}
          value={group}
          options={data.bloodGroups.map((value) => ({ value, label: value }))}
          onChange={(value) => setGroup(data.bloodGroups.find((g) => g === value) ?? null)}
          error={showErrors && problems.group ? t('m.bloodDonors.groupError') : null}
        />
        <AppText step="secondary" tone="muted">
          {t('m.bloodDonors.selfDeclared')}
        </AppText>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.bloodDonors.areaHeading')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.bloodDonors.areaHint')}
        </AppText>
        <BroadAreaFields value={area} onChange={setArea} error={showErrors && problems.area ? t('m.bloodDonors.areaError') : null} />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.bloodDonors.contactHeading')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.bloodDonors.contactHint')}
        </AppText>
        <TextField
          label={t('m.bloodDonors.contactName')}
          value={name}
          maxLength={DONOR_LIMITS.nameMax}
          autoComplete="name"
          onChangeText={setName}
          error={showErrors && problems.name ? t('m.bloodDonors.nameError') : null}
        />
        <TextField
          label={t('m.bloodDonors.contactPhone')}
          value={phone}
          keyboardType="phone-pad"
          maxLength={16}
          onChangeText={setPhone}
          error={showErrors && problems.phone ? t('m.bloodDonors.phoneError') : null}
        />
        <AppText step="label">{t('m.bloodDonors.contactWays')}</AppText>
        {CONTACT_METHODS.map((method) => (
          <Checkbox
            key={method}
            label={t(`m.bloodDonors.method_${method}`)}
            checked={methods.includes(method)}
            onChange={(on) => toggle(method, on)}
          />
        ))}
        {showErrors && problems.methods ? (
          <AppText step="secondary" tone="error">
            {t('m.bloodDonors.methodsError')}
          </AppText>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.bloodDonors.availabilityHeading')}
        </AppText>
        <ChipRow
          label={t('m.bloodDonors.availabilityHeading')}
          selected={availability}
          onSelect={(choice) => {
            setAvailability(choice);
            setAvailabilityChanged(true);
          }}
          options={AVAILABILITY.map((key) => ({ key, label: t(`m.bloodDonors.availability_${key}`) }))}
        />
        <AppText step="secondary" tone="muted">
          {t(`m.bloodDonors.availabilityHelp_${availability}`)}
        </AppText>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Checkbox label={t('m.bloodDonors.consentLabel')} checked={consent} onChange={setConsent} />
        {showErrors && problems.consent ? (
          <AppText step="secondary" tone="error">
            {t('m.bloodDonors.consentError')}
          </AppText>
        ) : null}
        {save.error ? <Notice tone="error">{errorMessage(t, save.error, 'bloodDonors')}</Notice> : null}
        <Button
          label={donor ? t('m.bloodDonors.saveChanges') : t('m.bloodDonors.join')}
          busy={save.busy}
          busyLabel={t('m.common.saving')}
          onPress={submit}
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  card: { gap: spacing[3] },
});
