import type { CommitteeItem, CommitteeItemInput, CommitteeRole, CommitteeRosterEntry } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  ChipRow,
  formatDateTime,
  Notice,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
} from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { committeeErrorMessage } from './committeeErrors';

type Kind = CommitteeItemInput['itemType'];

/** What each role may post here; the API checks it again (RB-09). */
const KINDS_BY_ROLE: Record<CommitteeRole, readonly Kind[]> = {
  coordinator: ['announcement', 'meeting', 'minutes', 'task', 'volunteer', 'document'],
  secretary: ['announcement', 'meeting', 'minutes'],
  member: [],
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A Sri Lanka wall-clock date and time as an ISO moment (UTC+05:30, no daylight saving). */
function sriLankaMoment(date: string, time: string): string {
  return `${date}T${time}:00+05:30`;
}

/**
 * S18: post an announcement, record a meeting or its minutes (sent for approval), give a task with
 * a due date, open a volunteer opportunity, or add a document with the roles that may open it.
 */
export function ComposeCard({
  committeeId,
  role,
  roster,
  meetings,
  onPosted,
}: {
  committeeId: string;
  role: CommitteeRole;
  roster: CommitteeRosterEntry[];
  meetings: CommitteeItem[];
  onPosted: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const kinds = KINDS_BY_ROLE[role];
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'announcement');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [place, setPlace] = useState('');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [places, setPlaces] = useState('');
  const [secretaryMayOpen, setSecretaryMayOpen] = useState(true);
  const [membersMayOpen, setMembersMayOpen] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);

  const problems: Record<string, string | null> = {
    title: title.trim().length < 3 ? t('s.committees.titleRequired') : null,
    body: body.trim().length < 1 ? t('s.committees.bodyRequired') : null,
    date: (kind === 'meeting' || kind === 'task' || kind === 'volunteer') && !validDate(date) ? t('s.committees.dateInvalid') : null,
    time: kind === 'meeting' && !TIME.test(time) ? t('s.committees.timeInvalid') : null,
    endTime: kind === 'meeting' && endTime !== '' && !TIME.test(endTime) ? t('s.committees.timeInvalid') : null,
    meeting: kind === 'minutes' && !meetingId ? t('s.committees.chooseMeeting') : null,
    assignee: kind === 'task' && !assignee ? t('s.committees.chooseAssignee') : null,
    places:
      kind === 'volunteer' && !(Number.isInteger(Number(places)) && Number(places) >= 1 && Number(places) <= 500)
        ? t('s.committees.placesInvalid')
        : null,
  };
  const shown = (key: string) => (showErrors ? problems[key] : null);

  const send = useApiAction(async () => {
    const input: CommitteeItemInput = { itemType: kind, title: title.trim(), body: body.trim() };
    if (kind === 'meeting') {
      input.startsAt = sriLankaMoment(date, time);
      if (endTime) input.endsAt = sriLankaMoment(date, endTime);
      input.place = place.trim() || null;
    }
    if (kind === 'minutes') input.meetingId = meetingId;
    if (kind === 'task' || kind === 'volunteer') input.dueOn = date;
    if (kind === 'task') input.assigneeMembershipId = assignee;
    if (kind === 'volunteer') input.places = Number(places);
    if (kind === 'document') {
      input.accessRoles = [
        'coordinator',
        ...(secretaryMayOpen ? (['secretary'] as const) : []),
        ...(membersMayOpen ? (['member'] as const) : []),
      ];
    }
    const item = await api().createCommitteeItem(committeeId, input);
    setTitle('');
    setBody('');
    setDate('');
    setTime('');
    setEndTime('');
    setPlace('');
    setMeetingId(null);
    setAssignee(null);
    setPlaces('');
    setShowErrors(false);
    setPosted(item.state === 'awaiting_approval' ? t('s.committees.sentForApproval') : t('s.committees.posted'));
    onPosted();
  });

  if (kinds.length === 0) return null;

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('s.committees.post')}
      </AppText>
      <AppText step="label">{t('s.committees.type')}</AppText>
      <ChipRow
        label={t('s.committees.type')}
        selected={kind}
        onSelect={(next) => {
          setKind(next);
          setPosted(null);
          setShowErrors(false);
        }}
        options={kinds.map((key) => ({ key, label: t(`s.committees.type_${key}`) }))}
      />
      <AppText step="secondary" tone="muted">
        {t(`s.committees.explain_${kind}`)}
      </AppText>
      <TextField label={t('s.committees.titleLabel')} value={title} maxLength={160} onChangeText={setTitle} error={shown('title')} />
      <TextField
        label={t('s.committees.bodyLabel')}
        value={body}
        multiline
        textAlignVertical="top"
        maxLength={8000}
        onChangeText={setBody}
        error={shown('body')}
      />

      {kind === 'meeting' || kind === 'task' || kind === 'volunteer' ? (
        <TextField
          label={kind === 'meeting' ? t('s.committees.date') : t('s.committees.dueDate')}
          hint={t('s.committees.dateHint')}
          placeholder="YYYY-MM-DD"
          value={date}
          maxLength={10}
          onChangeText={setDate}
          error={shown('date')}
        />
      ) : null}
      {kind === 'meeting' ? (
        <>
          <TextField
            label={t('s.committees.time')}
            hint={t('s.committees.timeHint')}
            placeholder="18:00"
            value={time}
            maxLength={5}
            onChangeText={setTime}
            error={shown('time')}
          />
          <TextField
            label={t('s.committees.endTime')}
            placeholder="20:00"
            optional
            value={endTime}
            maxLength={5}
            onChangeText={setEndTime}
            error={shown('endTime')}
          />
          <TextField label={t('s.committees.place')} optional value={place} maxLength={200} onChangeText={setPlace} />
        </>
      ) : null}
      {kind === 'minutes' ? (
        meetings.length === 0 ? (
          <Notice tone="info">{t('s.committees.recordMeetingFirst')}</Notice>
        ) : (
          <SelectField
            label={t('s.committees.meeting')}
            placeholder={t('s.committees.chooseMeeting')}
            value={meetingId}
            onChange={setMeetingId}
            error={shown('meeting')}
            options={meetings.map((meeting) => ({
              value: meeting.id,
              label: meeting.startsAt ? `${meeting.title} · ${formatDateTime(meeting.startsAt, language)}` : meeting.title,
            }))}
          />
        )
      ) : null}
      {kind === 'task' ? (
        <SelectField
          label={t('s.committees.assignee')}
          placeholder={t('s.committees.chooseAssignee')}
          value={assignee}
          onChange={setAssignee}
          error={shown('assignee')}
          options={roster.map((entry) => ({ value: entry.id, label: `${entry.name} · ${entry.memberCode}` }))}
        />
      ) : null}
      {kind === 'volunteer' ? (
        <TextField
          label={t('s.committees.places')}
          keyboardType="number-pad"
          value={places}
          maxLength={3}
          onChangeText={setPlaces}
          error={shown('places')}
        />
      ) : null}
      {kind === 'document' ? (
        <View style={styles.access}>
          <AppText step="label">{t('s.committees.access')}</AppText>
          <AppText step="secondary" tone="muted">
            {t('s.committees.accessHint')}
          </AppText>
          <Checkbox label={t('m.committees.role_secretary')} checked={secretaryMayOpen} onChange={setSecretaryMayOpen} />
          <Checkbox label={t('m.committees.role_member')} checked={membersMayOpen} onChange={setMembersMayOpen} />
        </View>
      ) : null}

      {posted ? <Notice tone="success">{posted}</Notice> : null}
      {send.error ? <Notice tone="error">{committeeErrorMessage(t, send.error)}</Notice> : null}
      <Button
        icon="send-outline"
        label={kind === 'minutes' ? t('s.committees.sendMinutes') : t('s.committees.send')}
        busy={send.busy}
        onPress={() => {
          setPosted(null);
          if (Object.values(problems).some(Boolean)) {
            setShowErrors(true);
            return;
          }
          void send.run();
        }}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  access: { gap: spacing[2] },
});
