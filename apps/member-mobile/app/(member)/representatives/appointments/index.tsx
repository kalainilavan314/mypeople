import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Screen, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { AppointmentCard } from '@/features/representatives/AppointmentCard';
import { hasStarted } from '@/features/representatives/labels';
import { api } from '@/lib/api';

/** M42 My appointments: the ones still ahead first, then earlier and cancelled ones with any follow-up note. */
export default function MyAppointmentsScreen() {
  const { t } = useTranslation();
  const appointments = useApiQuery(() => api().listMyAppointments());
  useReloadOnFocus(appointments.reload);

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={appointments.reload}
      refreshing={appointments.loading && appointments.data !== undefined}>
      <FeatureQueryView feature="representatives" query={appointments}>
        {(items) => {
          if (items.length === 0) {
            return (
              <View style={styles.section}>
                <AppText step="secondary" tone="muted">
                  {t('m.representatives.noAppointments')}
                </AppText>
                <Button
                  label={t('m.representatives.findRepresentative')}
                  icon="people-outline"
                  onPress={() => router.replace('/representatives')}
                />
              </View>
            );
          }
          const ahead = items
            .filter((item) => item.state === 'booked' && !hasStarted(item.slot.startsAt))
            .sort((a, b) => Date.parse(a.slot.startsAt) - Date.parse(b.slot.startsAt));
          const earlier = items.filter((item) => !ahead.includes(item));
          return (
            <>
              <View style={styles.section}>
                <AppText step="section" accessibilityRole="header">
                  {t('m.representatives.upcoming')}
                </AppText>
                {ahead.length === 0 ? (
                  <AppText step="secondary" tone="muted">
                    {t('m.representatives.noUpcoming')}
                  </AppText>
                ) : (
                  ahead.map((item) => <AppointmentCard key={item.id} appointment={item} />)
                )}
              </View>
              {earlier.length > 0 ? (
                <View style={styles.section}>
                  <AppText step="section" accessibilityRole="header">
                    {t('m.representatives.earlier')}
                  </AppText>
                  {earlier.map((item) => (
                    <AppointmentCard key={item.id} appointment={item} />
                  ))}
                </View>
              ) : null}
            </>
          );
        }}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: spacing[3] } });
