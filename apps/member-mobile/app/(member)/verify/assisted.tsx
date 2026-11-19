import type {
  AssistedHelpRequest,
  AssistedPreferredTime,
  AssistedReason,
  AssistedRoute,
  MyAssistedVerification,
} from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  formatDate,
  formatDateTime,
  Notice,
  Screen,
  SelectField,
  StatusTag,
  SurfaceCard,
  type Tone,
  useApiAction,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const REASONS: AssistedReason[] = ['no_camera', 'checks_failed', 'member_asked'];
const ROUTES: AssistedRoute[] = ['supervised_capture', 'office_visit', 'call_back'];
const TIMES: AssistedPreferredTime[] = ['morning', 'afternoon', 'evening'];
const ANY = 'any';
const OPEN = new Set(['requested', 'scheduled', 'in_session']);

const STATE_TONE: Record<AssistedHelpRequest['state'], Tone> = {
  requested: 'pending',
  scheduled: 'pending',
  in_session: 'pending',
  completed: 'verified',
  cancelled: 'neutral',
  closed: 'neutral',
};

/**
 * M05 Assisted verification request (FR-IDV-014, BR-010, BR-144, OD-04): for a member whose phone
 * has no working camera, whose photos failed the checks three times, or who simply asks. It asks
 * for no ID data: only why, how (help on their own phone, a district-office visit, or a call back
 * first) and when suits them. The photos are later taken on the member's own phone, or an office
 * device, through the normal photo screen; a reviewer still decides.
 */
export default function AssistedVerificationScreen() {
  const { t } = useTranslation();
  const query = useApiQuery(() => api().getMyAssistedVerification());
  useReloadOnFocus(query.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={query.reload} refreshing={query.loading && query.data !== undefined}>
      <AppText step="body" tone="secondary">
        {t('m.verify.assistedIntro')}
      </AppText>
      <FeatureQueryView feature="verify" query={query}>
        {(data) => <AssistedBody data={data} reload={query.reload} />}
      </FeatureQueryView>
    </Screen>
  );
}

function AssistedBody({ data, reload }: { data: MyAssistedVerification; reload: () => void }) {
  const { t } = useTranslation();
  const [askAgain, setAskAgain] = useState(false);
  const request = data.request;

  if (data.identityVerified) return <Notice tone="success">{t('m.verify.assistedAlreadyVerified')}</Notice>;
  if (request && OPEN.has(request.state)) return <OpenRequest request={request} reload={reload} />;
  if (data.reviewState === 'submitted' || data.reviewState === 'in_review') {
    return (
      <>
        {request?.state === 'completed' ? <PastRequest request={request} /> : null}
        <Notice tone="info">{t('m.verify.assistedReviewOpen')}</Notice>
      </>
    );
  }
  return (
    <>
      {request && !askAgain ? (
        <>
          <PastRequest request={request} />
          <Button label={t('m.verify.assistedAskAgain')} variant="secondary" onPress={() => setAskAgain(true)} />
        </>
      ) : (
        <RequestForm data={data} onSent={reload} />
      )}
    </>
  );
}

function RequestState({ request }: { request: AssistedHelpRequest }) {
  const { t } = useTranslation();
  return <StatusTag tone={STATE_TONE[request.state]} label={t(`m.verify.assistedState_${request.state}`)} />;
}

function OpenRequest({ request, reload }: { request: AssistedHelpRequest; reload: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const cancel = useApiAction(async () => {
    const yes = await confirmAction({
      title: t('m.verify.assistedCancel'),
      message: t('m.verify.assistedCancelConfirm'),
      confirmLabel: t('m.common.yes'),
      cancelLabel: t('m.common.no'),
      destructive: true,
    });
    if (!yes) return;
    await api().cancelAssistedVerification();
    reload();
  });
  return (
    <>
      <ReceiptCard title={t('m.verify.assistedSent')} referenceLabel={t('m.verify.assistedReference')} reference={request.requestRef}>
        <RequestState request={request} />
        <AppText step="secondary" tone="secondary">
          {t(`m.verify.assistedRoute_${request.route}`)}
        </AppText>
        {request.state === 'scheduled' && request.scheduledFor ? (
          <View style={styles.arranged}>
            <AppText step="label">{t('m.verify.assistedWhen', { when: formatDateTime(request.scheduledFor, language) })}</AppText>
            {request.meetingPlace ? (
              <AppText step="label">{t('m.verify.assistedWhere', { place: request.meetingPlace })}</AppText>
            ) : null}
          </View>
        ) : (
          <AppText step="secondary" tone="muted">
            {t('m.verify.assistedPreferred', {
              day: request.preferredDate ? formatDate(request.preferredDate, language) : t('m.verify.assistedAnyDay'),
              time: t(`m.verify.assistedTime_${request.preferredTime ?? ANY}`),
            })}
          </AppText>
        )}
      </ReceiptCard>
      <Notice tone="info">{t('m.verify.assistedBring')}</Notice>
      <AppText step="secondary" tone="secondary">
        {t('m.verify.assistedDuringSession')}
      </AppText>
      <Button label={t('m.verify.assistedOpenPhotos')} icon="camera-outline" onPress={() => router.push('/verify')} />
      {request.state !== 'in_session' ? (
        <>
          {cancel.error ? <Notice tone="error">{errorMessage(t, cancel.error, 'verify')}</Notice> : null}
          <Button
            label={t('m.verify.assistedCancel')}
            variant="danger"
            busy={cancel.busy}
            busyLabel={t('m.common.sending')}
            onPress={() => void cancel.run()}
          />
        </>
      ) : null}
    </>
  );
}

function PastRequest({ request }: { request: AssistedHelpRequest }) {
  const { t } = useTranslation();
  return (
    <SurfaceCard>
      <AppText step="secondary" tone="muted" mono>
        {request.requestRef}
      </AppText>
      <RequestState request={request} />
      {request.state === 'completed' ? (
        <AppText step="secondary" tone="secondary">
          {t('m.verify.assistedCompletedBody')}
        </AppText>
      ) : null}
      {request.closedReason ? (
        <AppText step="secondary" tone="secondary">
          {t(`m.verify.assistedClosed_${request.closedReason}`)}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

function RequestForm({ data, onSent }: { data: MyAssistedVerification; onSent: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const params = useLocalSearchParams<{ reason?: string }>();
  const initialReason = REASONS.find((reason) => reason === params.reason) ?? null;
  const [reason, setReason] = useState<AssistedReason | null>(initialReason);
  const [route, setRoute] = useState<AssistedRoute | null>(initialReason === 'no_camera' ? 'office_visit' : null);
  const [day, setDay] = useState<string>(ANY);
  const [time, setTime] = useState<string>(ANY);
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index + 1);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { value: iso, label: formatDate(`${iso}T06:00:00Z`, language) };
    });
  }, [language]);
  const send = useApiAction(async () => {
    if (!reason || !route) return;
    await api().requestAssistedVerification({
      reason,
      route,
      preferredDate: day === ANY ? null : day,
      preferredTime: time === ANY ? null : (time as AssistedPreferredTime),
    });
    onSent();
  });

  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('m.verify.helpTitle')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.verify.assistedNoIdData')}
      </AppText>
      <SelectField
        label={t('m.verify.assistedReason')}
        value={reason}
        placeholder={t('m.verify.assistedChoose')}
        options={REASONS.map((value) => ({ value, label: t(`m.verify.assistedReason_${value}`) }))}
        onChange={(value) => setReason(value as AssistedReason)}
      />
      <SelectField
        label={t('m.verify.assistedRoute')}
        value={route}
        placeholder={t('m.verify.assistedChoose')}
        options={ROUTES.map((value) => ({ value, label: t(`m.verify.assistedRoute_${value}`) }))}
        onChange={(value) => setRoute(value as AssistedRoute)}
      />
      <SelectField
        label={t('m.verify.assistedDay')}
        value={day}
        placeholder={t('m.verify.assistedChoose')}
        options={[{ value: ANY, label: t('m.verify.assistedAnyDay') }, ...days]}
        onChange={setDay}
      />
      <SelectField
        label={t('m.verify.assistedTime')}
        value={time}
        placeholder={t('m.verify.assistedChoose')}
        options={[ANY, ...TIMES].map((value) => ({ value, label: t(`m.verify.assistedTime_${value}`) }))}
        onChange={setTime}
      />
      {!data.contactOnRecord ? (
        <>
          <Notice tone="warning">{t('m.verify.assistedContactMissing')}</Notice>
          <Button
            label={t('m.verify.assistedConfirmNumber')}
            variant="secondary"
            icon="call-outline"
            onPress={() => router.push('/profile/recovery-number')}
          />
        </>
      ) : null}
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'verify')}</Notice> : null}
      <Button
        label={t('m.verify.assistedSend')}
        busy={send.busy}
        busyLabel={t('m.common.sending')}
        disabled={!reason || !route || !data.contactOnRecord}
        onPress={() => void send.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  arranged: { gap: spacing[1] },
});
