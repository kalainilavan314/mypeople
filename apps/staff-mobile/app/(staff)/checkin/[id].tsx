import { ApiError, type ManualCheckIn, type PassScan } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
} from '@my-people/mobile-ui';

import { ResultBanner } from '@/features/scan/ResultBanner';
import { Scanner } from '@/features/scan/Scanner';
import { offlineAttendanceReady, prepareOfflineAttendance, queueAttendance } from '@/features/scan/offlineQueue';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Result = PassScan | ManualCheckIn | { result: 'queued'; fullName?: undefined; memberCode?: undefined };

const RECORDED = new Set(['checked_in', 'already_checked_in']);

/**
 * S08: scan event passes at this event (FR-STF-006, BR-061, BR-062), or, when
 * a pass cannot be scanned, check the member in by the ID on their card with
 * a reason (FR-VOI-007). The API decides every result.
 */
export default function EventCheckInScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useApiQuery(() => api().getEvent(id), [id]);
  const [result, setResult] = useState<Result | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [reason, setReason] = useState('');
  const [offlineReady, setOfflineReady] = useState(false);

  const prepare = useApiAction(async () => {
    await prepareOfflineAttendance();
    setOfflineReady(await offlineAttendanceReady());
  });
  const scan = useApiAction(async (code: string) => {
    try {
      setResult(await api().scanEventPass(id, code));
    } catch (error) {
      if (error instanceof ApiError || !await offlineAttendanceReady()) throw error;
      await queueAttendance(id, code);
      setResult({ result: 'queued' });
    }
  });
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
      <Scanner paused={result !== null || scan.busy} onScan={(code) => void scan.run(code)} />
      <Notice tone="warning">{t('s.checkIn.offlineProvisional')}</Notice>
      <Button
        label={offlineReady ? t('s.checkIn.offlineReady') : t('s.checkIn.prepareOffline')}
        variant="secondary"
        busy={prepare.busy}
        disabled={offlineReady}
        onPress={() => void prepare.run()}
      />
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
