import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  formatDateTime,
  formatTime,
  Notice,
  Screen,
  SegmentedControl,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { appointmentError } from '@/features/staff/appointments/appointmentErrors';
import { colomboStart, MAX_SLOTS, SLOT_MINUTES, seriesEnd, slotCount } from '@/features/staff/appointments/slotSeries';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

type Mode = 'in_person' | 'phone_call';
type Minutes = `${(typeof SLOT_MINUTES)[number]}`;

/**
 * S17 Publish slots: consecutive appointment times of one length, in Sri Lankan time. The API
 * refuses any that overlap a slot already published.
 */
export default function AddSlotsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { permissions } = useStaff();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState<Minutes>('30');
  const [count, setCount] = useState('4');
  const [mode, setMode] = useState<Mode>('in_person');
  const [placeTa, setPlaceTa] = useState('');
  const [placeEn, setPlaceEn] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const start = colomboStart(date, time);
  const slots = slotCount(count);
  const add = useApiAction(async () => {
    if (!start || !slots) return;
    await api().addOwnAppointmentSlots({
      startsAt: start,
      minutes: Number(minutes),
      count: slots,
      mode,
      placeEn: mode === 'in_person' ? placeEn.trim() : null,
      placeTa: mode === 'in_person' ? placeTa.trim() : null,
    });
    router.back();
  });

  if (!permissions.has('appointment.manage_own')) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.appointments.noAccess')}</Notice>
      </Screen>
    );
  }
  const problems = {
    start: !start,
    count: !slots,
    place: mode === 'in_person' && (placeTa.trim().length < 3 || placeEn.trim().length < 3),
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <AppText step="body" tone="secondary">
        {t('s.appointments.slotsIntro')}
      </AppText>
      <SurfaceCard style={styles.card}>
        <TextField
          label={t('s.appointments.date')}
          hint={t('s.appointments.dateHint')}
          value={date}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          onChangeText={setDate}
          error={showErrors && problems.start ? t('s.appointments.dateError') : null}
        />
        <TextField
          label={t('s.appointments.startTime')}
          hint={t('s.appointments.startTimeHint')}
          value={time}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          onChangeText={setTime}
        />
        <View style={styles.field}>
          <AppText step="label">{t('s.appointments.length')}</AppText>
          <ChipRow
            label={t('s.appointments.length')}
            selected={minutes}
            onSelect={setMinutes}
            options={SLOT_MINUTES.map((value) => ({
              key: `${value}` as Minutes,
              label: t('s.appointments.minutes', { count: value }),
            }))}
          />
        </View>
        <TextField
          label={t('s.appointments.count')}
          hint={t('s.appointments.countHint', { max: MAX_SLOTS })}
          value={count}
          maxLength={2}
          keyboardType="number-pad"
          onChangeText={setCount}
          error={showErrors && problems.count ? t('s.appointments.countError', { max: MAX_SLOTS }) : null}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <SegmentedControl
          label={t('s.appointments.mode')}
          selected={mode}
          onSelect={setMode}
          options={[
            { key: 'in_person', label: t('m.representatives.mode_in_person') },
            { key: 'phone_call', label: t('m.representatives.mode_phone_call') },
          ]}
        />
        {mode === 'in_person' ? (
          <>
            <TextField
              label={t('s.appointments.placeTa')}
              hint={t('s.appointments.placeHint')}
              value={placeTa}
              maxLength={450}
              onChangeText={setPlaceTa}
              error={showErrors && problems.place && placeTa.trim().length < 3 ? t('s.appointments.placeError') : null}
            />
            <TextField
              label={t('s.appointments.placeEn')}
              value={placeEn}
              maxLength={300}
              onChangeText={setPlaceEn}
              error={showErrors && problems.place && placeEn.trim().length < 3 ? t('s.appointments.placeError') : null}
            />
          </>
        ) : (
          <AppText step="secondary" tone="secondary">
            {t('s.appointments.phoneModeHint')}
          </AppText>
        )}
      </SurfaceCard>

      {start && slots ? (
        <Notice tone="info">
          {t('s.appointments.preview', {
            count: slots,
            from: formatDateTime(start, language),
            to: formatTime(seriesEnd(start, Number(minutes), slots), language),
          })}
        </Notice>
      ) : null}
      {add.error ? <Notice tone="error">{appointmentError(t, add.error)}</Notice> : null}
      <Button
        label={t('s.appointments.publishSlots')}
        icon="calendar-outline"
        busy={add.busy}
        onPress={() => {
          if (Object.values(problems).some(Boolean)) {
            setShowErrors(true);
            return;
          }
          void add.run();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  field: { gap: spacing[2] },
});
