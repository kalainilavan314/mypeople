import type { AppointmentCalendar, AppointmentCalendarSlot } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatSpan,
  MenuRow,
  Notice,
  Screen,
  SegmentedControl,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { hasStarted, slotsByDay, STATE_TONES } from '@/features/representatives/labels';
import { useSlotPlace } from '@/features/representatives/SlotList';
import { appointmentError } from '@/features/staff/appointments/appointmentErrors';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

type Period = 'ahead' | 'past';

/**
 * S17 Appointment calendar: the representative's own slots and bookings, each with the member's
 * needs, and the meetings that still need a follow-up note. Only their own calendar (PRM-56); the
 * API checks it again on every request.
 */
export default function AppointmentCalendarScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const calendar = useApiQuery(
    async () => (permissions.has('appointment.manage_own') ? api().getAppointmentCalendar({ days: 60 }) : null),
    [permissions],
  );
  useReloadOnFocus(calendar.reload);

  if (!permissions.has('appointment.manage_own')) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.appointments.noAccess')}</Notice>
      </Screen>
    );
  }
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={calendar.reload}
      refreshing={calendar.loading && calendar.data !== undefined}>
      <QueryView query={calendar}>
        {(data) => (data ? <Calendar calendar={data} reload={calendar.reload} /> : null)}
      </QueryView>
    </Screen>
  );
}

function Calendar({ calendar, reload }: { calendar: AppointmentCalendar; reload: () => void }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('ahead');
  const profile = calendar.profile;
  if (!profile) {
    return <Notice tone="info" title={t('s.appointments.noProfileTitle')}>{t('s.appointments.noProfileBody')}</Notice>;
  }
  const ahead = calendar.slots.filter((slot) => !hasStarted(slot.endsAt));
  const past = calendar.slots.filter((slot) => hasStarted(slot.endsAt));
  const followUps = past.filter((slot) => slot.booking?.state === 'booked').length;

  return (
    <>
      <ProfileSummary calendar={calendar} reload={reload} />
      {profile.state !== 'withdrawn' ? (
        <Button
          label={t('s.appointments.addSlots')}
          icon="calendar-outline"
          onPress={() => router.push('/staff/appointments/slots')}
        />
      ) : null}
      {followUps > 0 ? (
        <Notice tone="warning" title={t('s.appointments.followUpsDueTitle', { count: followUps })}>
          {t('s.appointments.followUpsDueBody')}
        </Notice>
      ) : null}
      <SegmentedControl
        label={t('s.appointments.title')}
        selected={period}
        onSelect={setPeriod}
        options={[
          { key: 'ahead', label: t('s.appointments.ahead') },
          { key: 'past', label: t('s.appointments.past') },
        ]}
      />
      <SlotDays slots={period === 'ahead' ? ahead : [...past].reverse()} reload={reload} past={period === 'past'} />
    </>
  );
}

function ProfileSummary({ calendar, reload }: { calendar: AppointmentCalendar; reload: () => void }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const profile = calendar.profile!;
  const area = useAreaName(profile.areaKey) ?? profile.areaKey;
  const hasContacts = Boolean(profile.publicPhone || profile.publicEmail || profile.officeAddressEn);
  const approve = useApiAction(async (yes: boolean) => {
    await api().approveOwnContacts(yes);
    reload();
  });

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {localized(profile.roleEn, profile.roleTa)}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {area}
      </AppText>
      <StatusTag
        tone={profile.state === 'published' ? 'verified' : profile.state === 'draft' ? 'pending' : 'error'}
        label={t(`s.appointments.profile_${profile.state}`)}
      />
      {profile.state === 'withdrawn' && profile.withdrawnReason ? (
        <AppText step="secondary" tone="muted">
          {profile.withdrawnReason}
        </AppText>
      ) : null}
      {hasContacts ? (
        profile.contactsApprovedAt ? (
          <>
            <AppText step="secondary" tone="secondary">
              {t('s.appointments.contactsShown')}
            </AppText>
            <Button
              label={t('s.appointments.hideContacts')}
              variant="quiet"
              busy={approve.busy}
              onPress={() => void approve.run(false)}
            />
          </>
        ) : (
          <>
            <Notice tone="warning" title={t('s.appointments.approveTitle')}>
              {[
                t('s.appointments.approveBody'),
                profile.publicPhone,
                profile.publicEmail,
                profile.officeAddressEn ? localized(profile.officeAddressEn, profile.officeAddressTa ?? '') : null,
              ]
                .filter(Boolean)
                .join('\n')}
            </Notice>
            <Button
              label={t('s.appointments.approveContacts')}
              icon="checkmark-circle-outline"
              busy={approve.busy}
              onPress={() => void approve.run(true)}
            />
          </>
        )
      ) : (
        <AppText step="secondary" tone="muted">
          {t('s.appointments.noContacts')}
        </AppText>
      )}
      {approve.error ? <Notice tone="error">{appointmentError(t, approve.error)}</Notice> : null}
      <MenuRow
        icon="create-outline"
        tint="teal"
        label={t('s.appointments.editProfile')}
        hint={t('s.appointments.editProfileHint')}
        onPress={() => router.push('/staff/appointments/profile')}
      />
    </SurfaceCard>
  );
}

function SlotDays({ slots, reload, past }: { slots: AppointmentCalendarSlot[]; reload: () => void; past: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  if (slots.length === 0) {
    return (
      <AppText step="secondary" tone="muted">
        {past ? t('s.appointments.noPast') : t('s.appointments.noSlots')}
      </AppText>
    );
  }
  const days = slotsByDay(slots, language);
  return (
    <View style={styles.days}>
      {(past ? [...days].reverse() : days).map(([day, items]) => (
        <View key={day} style={styles.day}>
          <AppText step="label" accessibilityRole="header">
            {day}
          </AppText>
          {items.map((slot) => (
            <SlotRow key={slot.id} slot={slot} reload={reload} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SlotRow({ slot, reload }: { slot: AppointmentCalendarSlot; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const place = useSlotPlace();
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');
  const withdraw = useApiAction(async () => {
    await api().withdrawOwnAppointmentSlot(slot.id, reason.trim());
    setWithdrawing(false);
    reload();
  });
  const booking = slot.booking;
  const time = formatSpan(slot.startsAt, slot.endsAt, language);
  const live = booking && booking.state !== 'cancelled' ? booking : null;
  const canWithdraw = slot.state === 'open' && !hasStarted(slot.startsAt);

  return (
    <SurfaceCard style={styles.card}>
      {booking ? (
        <MenuRow
          first
          icon="person-outline"
          tint="teal"
          label={`${time} · ${booking.memberName}`}
          hint={[
            t(`m.representatives.state_${booking.state}`),
            booking.needs.length > 0 ? t('s.appointments.needsCount', { count: booking.needs.length }) : null,
            booking.state === 'booked' && hasStarted(slot.startsAt) ? t('s.appointments.followUpDue') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push({ pathname: '/staff/appointments/[id]', params: { id: booking.id } })}
        />
      ) : (
        <MenuRow
          first
          icon={slot.mode === 'phone_call' ? 'call-outline' : 'location-outline'}
          tint="sand"
          label={time}
          hint={slot.state === 'withdrawn' ? t('s.appointments.withdrawnSlot') : `${t('s.appointments.free')} · ${place(slot)}`}
        />
      )}
      {booking ? <StatusTag tone={STATE_TONES[booking.state]} label={t(`m.representatives.state_${booking.state}`)} /> : null}
      {slot.state === 'withdrawn' && booking ? (
        <AppText step="caption" tone="muted">
          {t('s.appointments.withdrawnSlot')}
        </AppText>
      ) : null}
      {canWithdraw ? (
        withdrawing ? (
          <>
            {live ? <Notice tone="warning">{t('s.appointments.withdrawBooked')}</Notice> : null}
            <TextField
              label={t('s.appointments.withdrawReason')}
              hint={t('s.appointments.withdrawReasonHint')}
              value={reason}
              maxLength={500}
              onChangeText={setReason}
            />
            {withdraw.error ? <Notice tone="error">{appointmentError(t, withdraw.error)}</Notice> : null}
            <Button
              label={t('s.appointments.withdrawConfirm')}
              variant="danger"
              busy={withdraw.busy}
              disabled={reason.trim().length < 3}
              onPress={() => void withdraw.run()}
            />
            <Button label={t('s.common.cancel')} variant="quiet" onPress={() => setWithdrawing(false)} />
          </>
        ) : (
          <Button label={t('s.appointments.withdraw')} variant="quiet" onPress={() => setWithdrawing(true)} />
        )
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  days: { gap: spacing[4] },
  day: { gap: spacing[2] },
});
