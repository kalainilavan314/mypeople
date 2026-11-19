import type { Appointment } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  DateBadge,
  formatSpan,
  StatusTag,
  SurfaceCard,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { STATE_TONES } from './labels';

/** One of the member's appointments: when, with whom, its state and whether a follow-up note came. */
export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const name = localized(appointment.representativeNameEn, appointment.representativeNameTa);
  const role = localized(appointment.representativeRoleEn, appointment.representativeRoleTa);
  const time = formatSpan(appointment.slot.startsAt, appointment.slot.endsAt, language);
  const state = t(`m.representatives.state_${appointment.state}`);

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/representatives/appointments/[id]', params: { id: appointment.id } })}
      accessibilityLabel={[name, role, time, state, appointment.followUpNote ? t('m.representatives.followUpAdded') : null]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={t('m.representatives.opensAppointment')}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <DateBadge iso={appointment.slot.startsAt} />
        </View>
        <View style={styles.text}>
          <AppText step="card">{name}</AppText>
          <AppText step="secondary" tone="secondary">
            {role}
          </AppText>
          <AppText step="secondary" tone="muted">
            {time}
          </AppText>
        </View>
      </View>
      <View style={styles.tags}>
        <StatusTag tone={STATE_TONES[appointment.state]} label={state} />
        {appointment.followUpNote ? <StatusTag tone="neutral" label={t('m.representatives.followUpAdded')} /> : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  badge: { flexShrink: 0 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
