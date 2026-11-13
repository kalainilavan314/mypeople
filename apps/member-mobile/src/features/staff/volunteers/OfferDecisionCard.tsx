import type { VolunteerOfferCard } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { volunteerErrorMessage } from './volunteerErrors';

// The limits the API enforces (OfferDecisionIn).
const MEETING_MIN = 3;
const ROLE_MIN = 3;

type Mode = 'confirm' | 'decline' | null;

/**
 * S10: one offer with the volunteer's consented skills, availability and travel area (no phone
 * number), confirmed with a meeting point in Tamil and English or declined with a reason.
 */
export function OfferDecisionCard({
  offer,
  skillName,
  onDecided,
}: {
  offer: VolunteerOfferCard;
  skillName: (key: string) => string;
  onDecided: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [mode, setMode] = useState<Mode>(null);
  const [meetingEn, setMeetingEn] = useState('');
  const [meetingTa, setMeetingTa] = useState('');
  const [roleEn, setRoleEn] = useState('');
  const [roleTa, setRoleTa] = useState('');
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const decide = useApiAction(async (confirm: boolean) => {
    await api().decideVolunteerOffer(
      offer.id,
      confirm
        ? {
            confirm: true,
            meetingPointEn: meetingEn.trim(),
            meetingPointTa: meetingTa.trim(),
            roleEn: roleEn.trim() || null,
            roleTa: roleTa.trim() || null,
          }
        : { confirm: false, reason: reason.trim() },
    );
    setMode(null);
    onDecided();
  });

  const meetingMissing = meetingEn.trim().length < MEETING_MIN || meetingTa.trim().length < MEETING_MIN;
  // A role is optional, but when one language is given both must be, at the API's length.
  const roleGiven = roleEn.trim() !== '' || roleTa.trim() !== '';
  const roleIncomplete = roleGiven && (roleEn.trim().length < ROLE_MIN || roleTa.trim().length < ROLE_MIN);
  const reasonMissing = reason.trim() === '';
  const submit = (confirm: boolean) => {
    if (confirm ? meetingMissing || roleIncomplete : reasonMissing) {
      setShowErrors(true);
      return;
    }
    void decide.run(confirm);
  };
  const open = (next: Mode) => {
    setShowErrors(false);
    decide.clearError();
    setMode(next);
  };

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="card">{offer.volunteerName}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {`${offer.memberCode} · ${offer.offerRef}`}
      </AppText>
      <StatusTag
        tone={offer.state === 'confirmed' ? 'verified' : offer.state === 'offered' ? 'pending' : 'neutral'}
        label={t(`m.profile.activityState_volunteer_offer_${offer.state}`)}
      />
      {offer.skills ? (
        <Line label={t('s.volunteers.skills')} value={offer.skills.map(skillName).join(', ') || t('s.volunteers.none')} />
      ) : (
        <AppText step="secondary" tone="muted">
          {t('s.volunteers.noProfile')}
        </AppText>
      )}
      {offer.availability ? (
        <Line
          label={t('s.volunteers.availability')}
          value={offer.availability.map((key) => t(`m.volunteer.availability_${key}`, { defaultValue: key })).join(', ')}
        />
      ) : null}
      {offer.travelArea ? (
        <Line label={t('s.volunteers.travelArea')} value={t(`m.volunteer.travel_${offer.travelArea}`, { defaultValue: offer.travelArea })} />
      ) : null}
      {offer.meetingPointEn ? <Line label={t('s.volunteers.meetingPoint')} value={offer.meetingPointEn} /> : null}
      {offer.decisionReason ? <Line label={t('s.common.reason')} value={offer.decisionReason} /> : null}
      <AppText step="caption" tone="muted">
        {t('s.volunteers.offeredOn', { date: formatDateTime(offer.createdAt, language) })}
      </AppText>

      {offer.state === 'offered' && mode === null ? (
        <>
          <Button label={t('s.volunteers.confirm')} icon="checkmark" onPress={() => open('confirm')} />
          <Button label={t('s.volunteers.decline')} variant="secondary" icon="close" onPress={() => open('decline')} />
        </>
      ) : null}

      {mode === 'confirm' ? (
        <View style={styles.form}>
          <TextField
            label={t('s.volunteers.meetingPointTa')}
            value={meetingTa}
            maxLength={300}
            onChangeText={setMeetingTa}
            error={showErrors && meetingTa.trim().length < MEETING_MIN ? t('s.volunteers.meetingPointError') : null}
          />
          <TextField
            label={t('s.volunteers.meetingPointEn')}
            value={meetingEn}
            maxLength={200}
            onChangeText={setMeetingEn}
            error={showErrors && meetingEn.trim().length < MEETING_MIN ? t('s.volunteers.meetingPointError') : null}
          />
          <TextField label={t('s.volunteers.roleTa')} hint={t('s.volunteers.roleHint')} optional value={roleTa} maxLength={160} onChangeText={setRoleTa} />
          <TextField
            label={t('s.volunteers.roleEn')}
            optional
            value={roleEn}
            maxLength={120}
            onChangeText={setRoleEn}
            error={showErrors && roleIncomplete ? t('s.volunteers.roleError') : null}
          />
          {decide.error ? <Notice tone="error">{volunteerErrorMessage(t, decide.error)}</Notice> : null}
          <Button label={t('s.volunteers.confirmOffer')} icon="checkmark" busy={decide.busy} onPress={() => submit(true)} />
          <Button label={t('s.common.cancel')} variant="quiet" disabled={decide.busy} onPress={() => setMode(null)} />
        </View>
      ) : null}

      {mode === 'decline' ? (
        <View style={styles.form}>
          <TextField
            label={t('s.common.reason')}
            hint={t('s.volunteers.declineHint')}
            value={reason}
            multiline
            textAlignVertical="top"
            maxLength={500}
            onChangeText={setReason}
            error={showErrors && reasonMissing ? t('s.volunteers.reasonError') : null}
          />
          {decide.error ? <Notice tone="error">{volunteerErrorMessage(t, decide.error)}</Notice> : null}
          <Button label={t('s.volunteers.declineOffer')} variant="danger" busy={decide.busy} onPress={() => submit(false)} />
          <Button label={t('s.common.cancel')} variant="quiet" disabled={decide.busy} onPress={() => setMode(null)} />
        </View>
      ) : null}
    </SurfaceCard>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText step="label">{label}</AppText>
      <AppText step="secondary" tone="secondary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  form: { gap: spacing[3], paddingTop: spacing[2] },
  line: { gap: 2 },
});
