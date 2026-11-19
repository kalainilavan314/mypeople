import type {
  AssistedAbandonReason,
  AssistedChecklistItem,
  AssistedCloseReason,
  AssistedDevice,
  AssistedRequestFile,
  AssistedSession,
} from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  confirmAction,
  formatDate,
  formatDateTime,
  Notice,
  Screen,
  SegmentedControl,
  SelectField,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { QueryView } from '@/components/QueryView';
import { CHECKLIST, STATE_TONE } from '@/features/staff/assisted/labels';
import { assistedProblem, canAssist } from '@/features/staff/assisted/problems';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

const ABANDON_REASONS: AssistedAbandonReason[] = ['member_absent', 'camera_failure', 'document_missing', 'member_declined', 'other'];
const CLOSE_REASONS: AssistedCloseReason[] = ['member_declined', 'member_unreachable', 'verified_another_way'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * S04 Assisted verification session (FR-STF-004, BR-010, BR-021, OD-04): arrange a time, start the
 * session as its witness, and watch the member take the photos on their own phone or an office
 * device: this screen never opens a camera and never shows an image, only which photos the server
 * has acknowledged. Submitting needs every checklist item and every photo; it sends the photos to
 * the normal identity review, which a different reviewer decides.
 */
export default function AssistedSessionScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const { id } = useLocalSearchParams<{ id: string }>();
  const file = useApiQuery(() => api().getAssistedRequest(id ?? ''), [id]);
  if (!canAssist(permissions)) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <Notice tone="info">{t('s.assisted.noAccess')}</Notice>
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={file.reload} refreshing={file.loading && file.data !== undefined}>
      <QueryView query={file}>{(data) => <SessionBody file={data} reload={file.reload} />}</QueryView>
    </Screen>
  );
}

function SessionBody({ file, reload }: { file: AssistedRequestFile; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const open = file.sessions.find((session) => session.endedAt === null) ?? null;
  const waiting = file.state === 'requested' || file.state === 'scheduled';

  return (
    <>
      <SurfaceCard>
        <AppText step="card" mono>
          {file.requestRef}
        </AppText>
        <StatusTag tone={STATE_TONE[file.state]} label={t(`s.assisted.state_${file.state}`)} />
        <View style={styles.details}>
          <DetailRow label={t('s.assisted.member')} value={`${file.fullName} · ${file.memberCode}`} />
          <DetailRow
            label={t('s.assisted.area')}
            value={[file.gnName, file.dsName, file.districtName].filter(Boolean).join(', ') || file.areaKey}
          />
        </View>
        <AppText step="secondary" tone="secondary">
          {`${t(`s.assisted.reason_${file.reason}`)} · ${t(`s.assisted.route_${file.route}`)}`}
        </AppText>
        <AppText step="secondary" tone="muted">
          {file.state === 'scheduled' && file.scheduledFor
            ? t('s.assisted.arranged', { when: formatDateTime(file.scheduledFor, language), place: file.meetingPlace ?? '' })
            : t('s.assisted.preferred', {
                day: file.preferredDate ? formatDate(file.preferredDate, language) : t('s.assisted.anyDay'),
                time: file.preferredTime ? t(`s.assisted.time_${file.preferredTime}`) : t('s.assisted.anyTime'),
              })}
        </AppText>
        {file.phone ? (
          <Button
            label={t('s.assisted.call', { phone: file.phone })}
            variant="secondary"
            icon="call-outline"
            onPress={() => void Linking.openURL(`tel:${file.phone}`)}
          />
        ) : (
          <AppText step="caption" tone="muted">
            {t('s.assisted.phoneHidden')}
          </AppText>
        )}
      </SurfaceCard>

      <Images file={file} reload={reload} />

      {file.state === 'completed' ? <Notice tone="success">{t('s.assisted.completedBody')}</Notice> : null}
      {waiting ? (
        <>
          <Schedule file={file} onDone={reload} />
          <Start file={file} onDone={reload} />
          <Close file={file} onDone={reload} />
        </>
      ) : null}
      {open && open.mine ? <Witness file={file} session={open} onDone={reload} /> : null}
      {open && !open.mine ? <Notice tone="info">{t('s.assisted.otherWitness')}</Notice> : null}
      {file.sessions.length > 0 ? <Sessions sessions={file.sessions} /> : null}
    </>
  );
}

/** Which photos the server holds: kinds and times only, never the images (BR-021). */
function Images({ file, reload }: { file: AssistedRequestFile; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('s.assisted.images')}
      </AppText>
      {file.images.map((image) => (
        <View key={image.kind} style={styles.image}>
          <AppText step="label" style={styles.flex}>
            {t(`s.assisted.kind_${image.kind}`)}
          </AppText>
          <StatusTag
            tone={image.receivedAt ? 'verified' : 'neutral'}
            label={image.receivedAt ? t('s.assisted.received', { time: formatDateTime(image.receivedAt, language) }) : t('s.assisted.notReceived')}
          />
        </View>
      ))}
      {!file.consentGiven ? <Notice tone="warning">{t('s.assisted.consentMissing')}</Notice> : null}
      <Button label={t('s.assisted.refresh')} variant="quiet" icon="refresh-outline" onPress={reload} />
    </SurfaceCard>
  );
}

function Schedule({ file, onDone }: { file: AssistedRequestFile; onDone: () => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState(file.meetingPlace ?? '');
  const [invalid, setInvalid] = useState(false);
  const save = useApiAction(async () => {
    if (!DATE.test(date.trim()) || !TIME.test(time.trim())) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    // Times are Sri Lankan local time (UTC+5:30, no daylight saving).
    await api().scheduleAssistedRequest(file.id, `${date.trim()}T${time.trim()}:00+05:30`, place.trim());
    onDone();
  });
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('s.assisted.scheduleTitle')}
      </AppText>
      <TextField label={t('s.assisted.scheduleDate')} hint={t('s.assisted.scheduleDateHint')} value={date} onChangeText={setDate} inputMode="numeric" />
      <TextField label={t('s.assisted.scheduleTime')} hint={t('s.assisted.scheduleTimeHint')} value={time} onChangeText={setTime} inputMode="numeric" />
      <TextField label={t('s.assisted.schedulePlace')} hint={t('s.assisted.schedulePlaceHint')} value={place} onChangeText={setPlace} maxLength={200} />
      {invalid ? <Notice tone="error">{t('s.assisted.scheduleInvalid')}</Notice> : null}
      {save.error ? <Notice tone="error">{assistedProblem(t, save.error)}</Notice> : null}
      <Button
        label={t('s.assisted.schedule')}
        icon="calendar-outline"
        busy={save.busy}
        busyLabel={t('s.common.saving')}
        disabled={!date.trim() || !time.trim() || place.trim().length < 3}
        onPress={() => void save.run()}
      />
    </SurfaceCard>
  );
}

function Start({ file, onDone }: { file: AssistedRequestFile; onDone: () => void }) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<AssistedDevice>(file.route === 'office_visit' ? 'office_device' : 'member_device');
  const start = useApiAction(async () => {
    await api().startAssistedSession(file.id, device);
    onDone();
  });
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('s.assisted.startTitle')}
      </AppText>
      <AppText step="label">{t('s.assisted.device')}</AppText>
      <SegmentedControl
        label={t('s.assisted.device')}
        selected={device}
        onSelect={setDevice}
        options={[
          { key: 'member_device', label: t('s.assisted.device_member_device') },
          { key: 'office_device', label: t('s.assisted.device_office_device') },
        ]}
      />
      <Notice tone="warning">{t('s.assisted.neverYourPhone')}</Notice>
      {start.error ? <Notice tone="error">{assistedProblem(t, start.error)}</Notice> : null}
      <Button label={t('s.assisted.start')} icon="people-outline" busy={start.busy} busyLabel={t('s.common.sending')} onPress={() => void start.run()} />
    </SurfaceCard>
  );
}

function Close({ file, onDone }: { file: AssistedRequestFile; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<AssistedCloseReason | null>(null);
  const close = useApiAction(async () => {
    if (!reason) return;
    const yes = await confirmAction({
      title: t('s.assisted.closeTitle'),
      message: t('s.assisted.closeConfirm'),
      confirmLabel: t('s.assisted.close'),
      cancelLabel: t('s.common.cancel'),
      destructive: true,
    });
    if (!yes) return;
    await api().closeAssistedRequest(file.id, reason);
    onDone();
  });
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('s.assisted.closeTitle')}
      </AppText>
      <SelectField
        label={t('s.common.reason')}
        value={reason}
        placeholder={t('s.assisted.choose')}
        options={CLOSE_REASONS.map((value) => ({ value, label: t(`s.assisted.close_${value}`) }))}
        onChange={(value) => setReason(value as AssistedCloseReason)}
      />
      {close.error ? <Notice tone="error">{assistedProblem(t, close.error)}</Notice> : null}
      <Button label={t('s.assisted.close')} variant="danger" busy={close.busy} disabled={!reason} onPress={() => void close.run()} />
    </SurfaceCard>
  );
}

/** FR-STF-004: the witness checklist; the session cannot be submitted until it is complete. */
function Witness({ file, session, onDone }: { file: AssistedRequestFile; session: AssistedSession; onDone: () => void }) {
  const { t } = useTranslation();
  const [ticked, setTicked] = useState<Set<AssistedChecklistItem>>(new Set());
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState<AssistedAbandonReason | null>(null);
  const missingImages = file.images.some((image) => !image.receivedAt);
  const complete = useApiAction(async () => {
    await api().completeAssistedSession(file.id, session.id, [...ticked], notes.trim() || undefined);
    onDone();
  });
  const abandon = useApiAction(async () => {
    if (!reason) return;
    await api().abandonAssistedSession(file.id, session.id, reason, notes.trim() || undefined);
    onDone();
  });
  const toggle = (item: AssistedChecklistItem, checked: boolean) => {
    setTicked((current) => {
      const next = new Set(current);
      if (checked) next.add(item);
      else next.delete(item);
      return next;
    });
  };
  const allTicked = CHECKLIST.every((item) => ticked.has(item));

  return (
    <>
      <SurfaceCard accent>
        <AppText step="section" accessibilityRole="header">
          {t('s.assisted.checklistTitle')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('s.assisted.checklistIntro')}
        </AppText>
        {CHECKLIST.map((item) => (
          <Checkbox key={item} label={t(`s.assisted.item_${item}`)} checked={ticked.has(item)} onChange={(checked) => toggle(item, checked)} />
        ))}
        <TextField
          label={t('s.assisted.notes')}
          hint={t('s.assisted.notesHint')}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={1000}
          optional
        />
        {missingImages ? <Notice tone="warning">{t('s.assisted.problems.missing')}</Notice> : null}
        {complete.error ? <Notice tone="error">{assistedProblem(t, complete.error)}</Notice> : null}
        <Button
          label={t('s.assisted.complete')}
          icon="checkmark-circle-outline"
          busy={complete.busy}
          busyLabel={t('s.common.sending')}
          disabled={!allTicked || missingImages || !file.consentGiven}
          onPress={() => void complete.run()}
        />
      </SurfaceCard>
      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('s.assisted.abandonTitle')}
        </AppText>
        <SelectField
          label={t('s.assisted.abandonReason')}
          value={reason}
          placeholder={t('s.assisted.choose')}
          options={ABANDON_REASONS.map((value) => ({ value, label: t(`s.assisted.abandon_${value}`) }))}
          onChange={(value) => setReason(value as AssistedAbandonReason)}
        />
        {abandon.error ? <Notice tone="error">{assistedProblem(t, abandon.error)}</Notice> : null}
        <Button label={t('s.assisted.abandon')} variant="danger" busy={abandon.busy} disabled={!reason} onPress={() => void abandon.run()} />
      </SurfaceCard>
    </>
  );
}

function Sessions({ sessions }: { sessions: AssistedSession[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('s.assisted.sessions')}
      </AppText>
      {sessions.map((session) => (
        <View key={session.id} style={styles.session}>
          <AppText step="secondary" tone="secondary">
            {session.endedAt === null
              ? t('s.assisted.session_open', { time: formatDateTime(session.startedAt, language) })
              : session.outcome === 'completed'
                ? t('s.assisted.session_completed', { time: formatDateTime(session.endedAt, language) })
                : t('s.assisted.session_abandoned', {
                    time: formatDateTime(session.endedAt, language),
                    reason: session.abandonReason ? t(`s.assisted.abandon_${session.abandonReason}`) : '',
                  })}
          </AppText>
          <AppText step="caption" tone="muted">
            {t(`s.assisted.device_${session.device}`)}
          </AppText>
          {session.notes ? (
            <AppText step="caption" tone="muted">
              {session.notes}
            </AppText>
          ) : null}
        </View>
      ))}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  details: { gap: spacing[2] },
  image: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 120 },
  session: { gap: 2, paddingVertical: spacing[1] },
});
