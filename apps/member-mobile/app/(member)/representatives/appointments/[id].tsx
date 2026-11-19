import type { Appointment, AppointmentSlot } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDate,
  formatDateTime,
  formatSpan,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { hasStarted, LIMITS, STATE_TONES } from '@/features/representatives/labels';
import { SlotList, useSlotPlace } from '@/features/representatives/SlotList';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * M42 Manage an appointment: when and where, what the member asked for, cancel or move it before it
 * starts, and the representative's follow-up note after the meeting (FR-APT-006).
 */
export default function AppointmentScreen() {
  const { id, booked } = useLocalSearchParams<{ id: string; booked?: string }>();
  const appointment = useApiQuery(() => api().getMyAppointment(id), [id]);
  useReloadOnFocus(appointment.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={appointment.reload}
      refreshing={appointment.loading && appointment.data !== undefined}>
      <FeatureQueryView feature="representatives" query={appointment}>
        {(data) => <AppointmentBody appointment={data} justBooked={booked === '1'} onChanged={appointment.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function AppointmentBody({
  appointment,
  justBooked,
  onChanged,
}: {
  appointment: Appointment;
  justBooked: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const place = useSlotPlace();
  const changeable = appointment.state === 'booked' && !hasStarted(appointment.slot.startsAt);
  const waitingForNote = appointment.state === 'booked' && hasStarted(appointment.slot.startsAt);
  const needs = appointment.needs.map((need) => t(`m.representatives.need_${need}`));

  return (
    <>
      {justBooked && appointment.state === 'booked' ? (
        <Notice tone="success" title={t('m.representatives.bookedTitle')}>
          {t('m.representatives.bookedBody')}
        </Notice>
      ) : null}
      <View style={styles.header}>
        <AppText step="page" accessibilityRole="header">
          {localized(appointment.representativeNameEn, appointment.representativeNameTa)}
        </AppText>
        <AppText step="body" tone="secondary">
          {localized(appointment.representativeRoleEn, appointment.representativeRoleTa)}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {appointment.appointmentRef}
        </AppText>
        <StatusTag tone={STATE_TONES[appointment.state]} label={t(`m.representatives.state_${appointment.state}`)} />
      </View>

      {appointment.state === 'cancelled' ? (
        <Notice tone="warning" title={t(`m.representatives.cancelledBy_${appointment.cancelledBy ?? 'member'}`)}>
          {appointment.cancelReason ?? t('m.representatives.noReasonGiven')}
        </Notice>
      ) : null}

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.followUp')}
        </AppText>
        {appointment.followUpNote ? (
          <>
            <AppText step="body">{appointment.followUpNote}</AppText>
            {appointment.followUpAt ? (
              <AppText step="caption" tone="muted">
                {t('m.representatives.followUpOn', { date: formatDate(appointment.followUpAt, language) })}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText step="secondary" tone="muted">
            {waitingForNote
              ? t('m.representatives.followUpWaiting')
              : appointment.state === 'booked'
                ? t('m.representatives.followUpLater')
                : t('m.representatives.followUpNone')}
          </AppText>
        )}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.details')}
        </AppText>
        <DetailRow
          label={t('m.representatives.when')}
          value={`${formatDate(appointment.slot.startsAt, language)}, ${formatSpan(appointment.slot.startsAt, appointment.slot.endsAt, language)}`}
        />
        <DetailRow label={t('m.representatives.where')} value={place(appointment.slot)} />
        <DetailRow label={t('m.representatives.topic')} value={appointment.topic} />
        <DetailRow
          label={t('m.representatives.contactPreference')}
          value={
            appointment.contactPhone
              ? `${t(`m.representatives.contact_${appointment.contactPreference}`)} · ${appointment.contactPhone}`
              : t(`m.representatives.contact_${appointment.contactPreference}`)
          }
        />
        <DetailRow
          label={t('m.representatives.needs')}
          value={[...needs, appointment.needsNote].filter(Boolean).join(', ') || t('m.representatives.noNeeds')}
        />
        <DetailRow label={t('m.representatives.caseRef')} value={appointment.caseRef ?? t('m.representatives.noCase')} />
        <DetailRow label={t('m.representatives.bookedOn')} value={formatDateTime(appointment.bookedAt, language)} />
      </SurfaceCard>

      {changeable ? <ChangeAppointment appointment={appointment} onChanged={onChanged} /> : null}

      <Button
        label={t('m.representatives.viewProfile')}
        variant="quiet"
        icon="person-outline"
        onPress={() => router.push({ pathname: '/representatives/[id]', params: { id: appointment.representativeId } })}
      />
    </>
  );
}

/** Move to another free time of the same representative, or cancel; both only before it starts. */
function ChangeAppointment({ appointment, onChanged }: { appointment: Appointment; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [moving, setMoving] = useState(false);
  const [reason, setReason] = useState('');
  const others = useApiQuery(
    async () => (moving ? (await api().getRepresentative(appointment.representativeId)).slots : null),
    [moving, appointment.representativeId],
  );
  const move = useApiAction(async (slot: AppointmentSlot) => {
    const confirmed = await confirmAction({
      title: t('m.representatives.moveTitle'),
      message: t('m.representatives.moveBody', {
        time: `${formatDate(slot.startsAt, language)}, ${formatSpan(slot.startsAt, slot.endsAt, language)}`,
      }),
      confirmLabel: t('m.representatives.moveConfirm'),
      cancelLabel: t('m.common.cancel'),
    });
    if (!confirmed) return;
    await api().rescheduleMyAppointment(appointment.id, slot.id);
    setMoving(false);
    onChanged();
  });
  const cancel = useApiAction(async () => {
    const confirmed = await confirmAction({
      title: t('m.representatives.cancelTitle'),
      message: t('m.representatives.cancelBody'),
      confirmLabel: t('m.representatives.cancelConfirm'),
      cancelLabel: t('m.common.back'),
      destructive: true,
    });
    if (!confirmed) return;
    await api().cancelMyAppointment(appointment.id, reason.trim() || undefined);
    onChanged();
  });

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.representatives.changeTitle')}
      </AppText>
      {moving ? (
        <>
          {others.loading ? (
            <AppText step="secondary" tone="muted">
              {t('m.common.loading')}
            </AppText>
          ) : others.error ? (
            <Notice tone="error">{errorMessage(t, others.error, 'representatives')}</Notice>
          ) : others.data && others.data.length > 0 ? (
            <SlotList slots={others.data} onChoose={(slot) => void move.run(slot)} />
          ) : (
            <AppText step="secondary" tone="muted">
              {t('m.representatives.noOtherSlots')}
            </AppText>
          )}
          {move.error ? <Notice tone="error">{errorMessage(t, move.error, 'representatives')}</Notice> : null}
          <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setMoving(false)} />
        </>
      ) : (
        <Button label={t('m.representatives.move')} icon="calendar-outline" variant="secondary" onPress={() => setMoving(true)} />
      )}
      <TextField
        label={t('m.representatives.cancelReason')}
        optional
        value={reason}
        maxLength={LIMITS.cancelReasonMax}
        onChangeText={setReason}
      />
      {cancel.error ? <Notice tone="error">{errorMessage(t, cancel.error, 'representatives')}</Notice> : null}
      <Button
        label={t('m.representatives.cancel')}
        icon="close-circle-outline"
        variant="danger"
        busy={cancel.busy}
        onPress={() => void cancel.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
});
