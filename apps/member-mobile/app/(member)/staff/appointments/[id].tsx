import type { AppointmentBooking } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
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
  SegmentedControl,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { QueryView } from '@/components/QueryView';
import { hasStarted, STATE_TONES } from '@/features/representatives/labels';
import { useSlotPlace } from '@/features/representatives/SlotList';
import { appointmentError } from '@/features/staff/appointments/appointmentErrors';
import { api } from '@/lib/api';

type Outcome = 'completed' | 'no_show';
const NOTE_MIN = 5;
const NOTE_MAX = 2000;

/**
 * S17 booking: who booked, what about, how they want to be contacted, their accessibility or
 * language needs and a case reference only when they consented to link it. After the meeting the
 * representative records the outcome and a follow-up note, which the member sees (FR-APT-006).
 */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApiQuery(() => api().getAppointmentBooking(id), [id]);
  useReloadOnFocus(booking.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={booking.reload}
      refreshing={booking.loading && booking.data !== undefined}>
      <QueryView query={booking}>{(data) => <BookingBody booking={data} onChanged={booking.reload} />}</QueryView>
    </Screen>
  );
}

function BookingBody({ booking, onChanged }: { booking: AppointmentBooking; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const place = useSlotPlace();
  const started = hasStarted(booking.slot.startsAt);
  const needs = booking.needs.map((need) => t(`m.representatives.need_${need}`));

  return (
    <>
      <View style={styles.header}>
        <AppText step="page" accessibilityRole="header">
          {booking.memberName}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {`${booking.memberCode} · ${booking.appointmentRef}`}
        </AppText>
        <StatusTag tone={STATE_TONES[booking.state]} label={t(`m.representatives.state_${booking.state}`)} />
      </View>

      {booking.state === 'cancelled' ? (
        <Notice tone="warning" title={t(`s.appointments.cancelledBy_${booking.cancelledBy ?? 'member'}`)}>
          {booking.cancelReason ?? t('m.representatives.noReasonGiven')}
        </Notice>
      ) : null}

      {/* FR-APT-004: "Given 'Tamil interpreter needed', then the representative sees it." */}
      {needs.length > 0 || booking.needsNote ? (
        <Notice tone="info" title={t('s.appointments.needs')}>
          {[...needs, booking.needsNote].filter(Boolean).join('\n')}
        </Notice>
      ) : null}

      <SurfaceCard style={styles.card}>
        <DetailRow
          label={t('m.representatives.when')}
          value={`${formatDate(booking.slot.startsAt, language)}, ${formatSpan(booking.slot.startsAt, booking.slot.endsAt, language)}`}
        />
        <DetailRow label={t('m.representatives.where')} value={place(booking.slot)} />
        <DetailRow label={t('m.representatives.topic')} value={booking.topic} />
        <DetailRow
          label={t('m.representatives.contactPreference')}
          value={t(`m.representatives.contact_${booking.contactPreference}`)}
        />
        {booking.contactPhone ? (
          <Button
            label={t('s.appointments.callMember', { phone: booking.contactPhone })}
            icon="call-outline"
            variant="secondary"
            onPress={() =>
              void Linking.openURL(`${booking.contactPreference === 'sms' ? 'sms' : 'tel'}:${booking.contactPhone}`)
            }
          />
        ) : null}
        <DetailRow
          label={t('m.representatives.caseRef')}
          value={
            booking.caseRef && booking.caseConsentAt
              ? t('s.appointments.caseLinked', { ref: booking.caseRef, date: formatDateTime(booking.caseConsentAt, language) })
              : t('m.representatives.noCase')
          }
        />
        <DetailRow label={t('m.representatives.bookedOn')} value={formatDateTime(booking.bookedAt, language)} />
      </SurfaceCard>

      {booking.state !== 'cancelled' && started ? <FollowUpForm booking={booking} onChanged={onChanged} /> : null}
      {booking.state === 'booked' && !started ? <CancelBooking booking={booking} onChanged={onChanged} /> : null}
    </>
  );
}

function FollowUpForm({ booking, onChanged }: { booking: AppointmentBooking; onChanged: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [outcome, setOutcome] = useState<Outcome>(booking.state === 'no_show' ? 'no_show' : 'completed');
  const [note, setNote] = useState(booking.followUpNote ?? '');
  const [showError, setShowError] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = useApiAction(async () => {
    await api().recordAppointmentFollowUp(booking.id, { outcome, note: note.trim() || null });
    setSaved(true);
    onChanged();
  });
  const short = note.trim().length > 0 && note.trim().length < NOTE_MIN;
  const missing = outcome === 'completed' && note.trim().length < NOTE_MIN;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.appointments.followUpTitle')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('s.appointments.followUpIntro')}
      </AppText>
      {booking.followUpAt ? (
        <AppText step="caption" tone="muted">
          {t('s.appointments.followUpSaved', { date: formatDateTime(booking.followUpAt, language) })}
        </AppText>
      ) : null}
      <SegmentedControl
        label={t('s.appointments.outcome')}
        selected={outcome}
        onSelect={(value) => {
          setSaved(false);
          setOutcome(value);
        }}
        options={[
          { key: 'completed', label: t('m.representatives.state_completed') },
          { key: 'no_show', label: t('m.representatives.state_no_show') },
        ]}
      />
      <TextField
        label={t('s.appointments.note')}
        hint={t('s.appointments.noteHint')}
        optional={outcome === 'no_show'}
        value={note}
        multiline
        textAlignVertical="top"
        maxLength={NOTE_MAX}
        onChangeText={(text) => {
          setSaved(false);
          setNote(text);
        }}
        error={showError && (missing || short) ? t('s.appointments.noteError', { min: NOTE_MIN }) : null}
      />
      {saved ? <Notice tone="success">{t('s.appointments.followUpDone')}</Notice> : null}
      {save.error ? <Notice tone="error">{appointmentError(t, save.error)}</Notice> : null}
      <Button
        label={t('s.appointments.saveFollowUp')}
        icon="checkmark-circle-outline"
        busy={save.busy}
        onPress={() => {
          if (missing || short) {
            setShowError(true);
            return;
          }
          void save.run();
        }}
      />
    </SurfaceCard>
  );
}

function CancelBooking({ booking, onChanged }: { booking: AppointmentBooking; onChanged: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const cancel = useApiAction(async () => {
    const confirmed = await confirmAction({
      title: t('s.appointments.cancelTitle'),
      message: t('s.appointments.cancelBody'),
      confirmLabel: t('s.appointments.cancelConfirm'),
      cancelLabel: t('s.common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await api().cancelAppointmentBooking(booking.id, reason.trim());
    onChanged();
  });
  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.appointments.cancelTitle')}
      </AppText>
      <TextField
        label={t('s.appointments.cancelReason')}
        hint={t('s.appointments.cancelReasonHint')}
        value={reason}
        maxLength={500}
        onChangeText={setReason}
      />
      {cancel.error ? <Notice tone="error">{appointmentError(t, cancel.error)}</Notice> : null}
      <Button
        label={t('s.appointments.cancelConfirm')}
        variant="danger"
        busy={cancel.busy}
        disabled={reason.trim().length < 3}
        onPress={() => void cancel.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
});
