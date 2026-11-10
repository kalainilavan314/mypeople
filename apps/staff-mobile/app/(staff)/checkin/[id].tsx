import type { ManualCheckIn, PassScan } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLocalized,
  useMember,
} from '@my-people/mobile-ui';

import { ResultBanner } from '@/features/scan/ResultBanner';
import { enqueueScan, queuedScans, syncScans } from '@/features/scan/offlineQueue';
import { Scanner } from '@/features/scan/Scanner';
import { api } from '@/lib/api';
import { errorMessage, noAnswer } from '@/lib/errors';

type Result = PassScan | ManualCheckIn;

const RECORDED = new Set(['checked_in', 'already_checked_in']);

/**
 * S08: scan event passes at this event (FR-STF-006, BR-061, BR-062), or, when
 * a pass cannot be scanned, check the member in by the ID on their card with
 * a reason (FR-VOI-007). The API decides every result.
 *
 * Without a connection a scanned pass is saved on the phone, shown as "not yet a check-in",
 * and sent when the phone is back online, where the server judges it as at the moment it
 * was scanned (MP-DEC-001 4.3). Sync is retried every 30 seconds while scans wait.
 */
export default function EventCheckInScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useApiQuery(() => api().getEvent(id), [id]);
  const [result, setResult] = useState<Result | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [reason, setReason] = useState('');
  const member = useMember();
  const [queued, setQueued] = useState(false);
  const [pending, setPending] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    setPending((await queuedScans(id, member.id)).length);
  }, [id, member.id]);

  const scan = useApiAction(async (code: string) => {
    try {
      setResult(await api().scanEventPass(id, code));
    } catch (error) {
      if (!noAnswer(error)) throw error;
      await enqueueScan(id, member.id, code);
      setQueued(true);
      await refreshPending();
    }
  });

  const sync = useApiAction(async () => {
    const outcomes = await syncScans(id, member.id);
    const count = (status: string) => outcomes.filter((outcome) => outcome.status === status).length;
    if (outcomes.length > 0) {
      setSummary(
        t('s.checkIn.syncResult', {
          accepted: count('ACCEPTED'),
          duplicate: count('DUPLICATE'),
          rejected: count('REJECTED'),
          waiting: count('NEEDS_REVIEW') + count('EXPIRED_QUEUE'),
        }),
      );
    }
    await refreshPending();
  });

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  // Quietly retried while scans wait; a failure here only means the phone is still offline.
  useEffect(() => {
    if (pending === 0) return;
    const timer = setInterval(() => {
      void syncScans(id, member.id)
        .then(() => refreshPending())
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(timer);
  }, [pending, id, member.id, refreshPending]);
  const manual = useApiAction(async () => {
    setResult(await api().checkInManually(id, memberCode.trim(), reason.trim()));
    setMemberCode('');
  });
  const failed = scan.error ?? manual.error;

  return (
    <Screen edges={['bottom']}>
      {event.data ? (
        <AppText step="section" accessibilityRole="header">
          {localized(event.data.titleEn, event.data.titleTa)}
        </AppText>
      ) : null}
      <Scanner
        paused={result !== null || queued || scan.busy}
        onScan={(code) => void scan.run(code)}
        deniedMessage={t('s.checkIn.cameraDenied')}
      />
      {queued ? (
        <>
          <Notice tone="warning" title={t('s.checkIn.queuedTitle')}>
            {t('s.checkIn.queuedBody')}
          </Notice>
          <Button label={t('s.checkIn.scanAgain')} icon="scan-outline" onPress={() => setQueued(false)} />
        </>
      ) : null}
      {pending > 0 ? (
        <SurfaceCard>
          <AppText step="label">{t('s.checkIn.pending', { count: pending })}</AppText>
          <Button label={t('s.checkIn.syncNow')} icon="cloud-upload-outline" variant="secondary" busy={sync.busy} busyLabel={t('s.checkIn.syncing')} onPress={() => void sync.run()} />
        </SurfaceCard>
      ) : null}
      {summary ? <Notice tone="info">{summary}</Notice> : null}
      {sync.error ? <Notice tone="error">{errorMessage(t, sync.error)}</Notice> : null}
      {result ? (
        <>
          <ResultBanner
            ok={RECORDED.has(result.result)}
            title={t(`s.checkIn.result_${result.result}`)}
            name={result.fullName}
            memberCode={result.memberCode}
          />
          <Button label={t('s.checkIn.scanAgain')} icon="scan-outline" onPress={() => setResult(null)} />
        </>
      ) : null}
      {failed ? <Notice tone="error">{errorMessage(t, failed)}</Notice> : null}

      <SurfaceCard>
        <AppText step="section">{t('s.checkIn.manualTitle')}</AppText>
        <AppText step="secondary" tone="muted">
          {t('s.checkIn.manualBody')}
        </AppText>
        <TextField label={t('s.checkIn.memberId')} value={memberCode} onChangeText={setMemberCode} autoCapitalize="characters" autoCorrect={false} />
        <TextField label={t('s.checkIn.reason')} value={reason} onChangeText={setReason} maxLength={500} />
        <Button
          label={t('s.checkIn.checkIn')}
          variant="secondary"
          busy={manual.busy}
          disabled={memberCode.trim().length < 3 || reason.trim().length < 3}
          onPress={() => void manual.run()}
        />
      </SurfaceCard>
      <Button
        label={t('s.checkIn.roster')}
        variant="quiet"
        icon="people-outline"
        onPress={() => router.push({ pathname: '/roster/[id]', params: { id } })}
      />
    </Screen>
  );
}
