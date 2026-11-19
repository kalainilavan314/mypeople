import type { RepresentativeOwnProfile } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { normalisePhone, PHONE } from '@/features/representatives/labels';
import { appointmentError } from '@/features/staff/appointments/appointmentErrors';
import { api } from '@/lib/api';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * S17 My public profile: the representative's own office hours and contact routes. Members see the
 * contact routes only when the person ticks "show" (BR-143, FR-APT-007); the role and area are set
 * by a profile manager on the dashboard.
 */
export default function OwnProfileScreen() {
  const { t } = useTranslation();
  const calendar = useApiQuery(() => api().getAppointmentCalendar({ days: 1 }));
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <QueryView query={calendar}>
        {(data) =>
          data.profile ? (
            <ProfileForm profile={data.profile} />
          ) : (
            <Notice tone="info" title={t('s.appointments.noProfileTitle')}>
              {t('s.appointments.noProfileBody')}
            </Notice>
          )
        }
      </QueryView>
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: RepresentativeOwnProfile }) {
  const { t } = useTranslation();
  const [hoursTa, setHoursTa] = useState(profile.officeHoursTa);
  const [hoursEn, setHoursEn] = useState(profile.officeHoursEn);
  const [phone, setPhone] = useState(profile.publicPhone ?? '');
  const [email, setEmail] = useState(profile.publicEmail ?? '');
  const [addressTa, setAddressTa] = useState(profile.officeAddressTa ?? '');
  const [addressEn, setAddressEn] = useState(profile.officeAddressEn ?? '');
  const [show, setShow] = useState(profile.contactsApprovedAt !== null);
  const [showErrors, setShowErrors] = useState(false);
  const save = useApiAction(async () => {
    await api().updateOwnRepresentativeProfile({
      officeHoursEn: hoursEn.trim(),
      officeHoursTa: hoursTa.trim(),
      publicPhone: phone.trim() ? normalisePhone(phone) : null,
      publicEmail: email.trim() || null,
      officeAddressEn: addressEn.trim() || null,
      officeAddressTa: addressTa.trim() || null,
      showContacts: show,
    });
    router.back();
  });
  const anyContact = Boolean(phone.trim() || email.trim() || addressEn.trim() || addressTa.trim());
  const problems = {
    hours: hoursTa.trim().length < 3 || hoursEn.trim().length < 3,
    phone: phone.trim() !== '' && !PHONE.test(normalisePhone(phone)),
    email: email.trim() !== '' && !EMAIL.test(email.trim()),
    show: show && !anyContact,
  };

  return (
    <>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('s.appointments.officeHours')}
        </AppText>
        <TextField
          label={t('s.appointments.officeHoursTa')}
          value={hoursTa}
          multiline
          textAlignVertical="top"
          maxLength={700}
          onChangeText={setHoursTa}
          error={showErrors && problems.hours ? t('s.appointments.officeHoursError') : null}
        />
        <TextField label={t('s.appointments.officeHoursEn')} value={hoursEn} multiline textAlignVertical="top" maxLength={500} onChangeText={setHoursEn} />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('s.appointments.contactRoutes')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('s.appointments.contactRoutesIntro')}
        </AppText>
        <TextField
          label={t('s.appointments.officePhone')}
          optional
          value={phone}
          keyboardType="phone-pad"
          maxLength={16}
          onChangeText={setPhone}
          error={showErrors && problems.phone ? t('m.representatives.phoneError') : null}
        />
        <TextField
          label={t('s.appointments.officeEmail')}
          optional
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={200}
          onChangeText={setEmail}
          error={showErrors && problems.email ? t('s.appointments.emailError') : null}
        />
        <TextField label={t('s.appointments.officeAddressTa')} optional value={addressTa} maxLength={450} onChangeText={setAddressTa} />
        <TextField label={t('s.appointments.officeAddressEn')} optional value={addressEn} maxLength={300} onChangeText={setAddressEn} />
        <Checkbox label={t('s.appointments.showContacts')} checked={show} onChange={setShow} />
        {showErrors && problems.show ? <Notice tone="error">{t('s.appointments.problems.no_contacts')}</Notice> : null}
      </SurfaceCard>

      {save.error ? <Notice tone="error">{appointmentError(t, save.error)}</Notice> : null}
      <Button
        label={t('s.appointments.saveProfile')}
        icon="checkmark-circle-outline"
        busy={save.busy}
        onPress={() => {
          if (Object.values(problems).some(Boolean)) {
            setShowErrors(true);
            return;
          }
          void save.run();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing[3] } });
