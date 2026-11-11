import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SecurityAlert, SecurityAlertAnswer } from '@my-people/api-client';
import { spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  confirmAction,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useSession,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage, problemsOf } from '@/lib/errors';

/**
 * M50 security alerts, signed-in devices with sign-out per device (FR-AUTH-018, 020, 021),
 * and changing the password with the current one.
 */
export default function SecurityScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const sessions = useApiQuery(() => api().listMySessions());
  const alerts = useApiQuery(() => api().listSecurityAlerts());
  const [secured, setSecured] = useState(false);
  // "This wasn't me" signs out every other device; the list of devices changes with it.
  const answer = useApiAction(async (alertId: string, reply: SecurityAlertAnswer) => {
    await api().answerSecurityAlert(alertId, reply);
    if (reply === 'not_me') setSecured(true);
    alerts.reload();
    sessions.reload();
  });
  const revoke = useApiAction(async (id: string) => {
    await api().revokeSession(id);
    sessions.reload();
  });
  const revokeOthers = useApiAction(async () => {
    await api().revokeOtherSessions();
    sessions.reload();
  });

  const reload = () => {
    alerts.reload();
    sessions.reload();
  };

  const confirmRevoke = (id: string, device: string) => confirmSecurityAction(
    t('m.profile.signOutDevice'),
    t('m.profile.revokeDeviceExplain', { device }),
    t('m.common.cancel'),
    () => void revoke.run(id),
  );
  const confirmOthers = () => confirmSecurityAction(
    t('m.profile.signOutOthers'),
    t('m.profile.revokeOthersExplain'),
    t('m.common.cancel'),
    () => void revokeOthers.run(),
  );

  return (
    <Screen edges={['bottom']} onRefresh={reload} refreshing={sessions.loading && sessions.data !== undefined}>
      {secured ? <Notice tone="success">{t('m.profile.alertSecured')}</Notice> : null}
      <QueryView query={alerts}>
        {(list) => <SecurityAlerts alerts={list} busy={answer.busy} onAnswer={(id, reply) => void answer.run(id, reply)} />}
      </QueryView>
      {answer.error ? <Notice tone="error">{errorMessage(t, answer.error)}</Notice> : null}
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.sessions')}
      </AppText>
      <QueryView query={sessions}>
        {(list) => (
          <>
            {list.map((session) => (
              <SurfaceCard key={session.id}>
                <View style={styles.row}>
                  <AppText step="card" style={styles.flex}>
                    {session.deviceLabel}
                  </AppText>
                  {session.current ? <StatusTag tone="verified" label={t('m.profile.thisDevice')} /> : null}
                </View>
                <AppText step="secondary" tone="muted">
                  {t('m.profile.lastUsed', { time: formatDateTime(session.lastSeenAt, language) })}
                </AppText>
                {!session.current ? (
                  <Button label={t('m.profile.signOutDevice')} variant="secondary" busy={revoke.busy} onPress={() => confirmRevoke(session.id, session.deviceLabel)} />
                ) : null}
              </SurfaceCard>
            ))}
            {list.some((session) => !session.current) ? (
              <Button label={t('m.profile.signOutOthers')} variant="danger" busy={revokeOthers.busy} onPress={confirmOthers} />
            ) : null}
          </>
        )}
      </QueryView>
      {revoke.error || revokeOthers.error ? <Notice tone="error">{errorMessage(t, revoke.error ?? revokeOthers.error)}</Notice> : null}
      <PasswordChange />
    </Screen>
  );
}

async function confirmSecurityAction(title: string, message: string, cancel: string, onConfirm: () => void) {
  if (await confirmAction({ title, message, confirmLabel: title, cancelLabel: cancel, destructive: true })) onConfirm();
}

type AlertsProps = {
  alerts: SecurityAlert[];
  busy: boolean;
  onAnswer: (alertId: string, reply: SecurityAlertAnswer) => void;
};

/** Open alerts ask "Was this you?"; answered ones stay listed with the answer given. */
function SecurityAlerts({ alerts, busy, onAnswer }: AlertsProps) {
  const { t } = useTranslation();
  const open = alerts.filter((alert) => alert.answer === null);
  const answered = alerts.filter((alert) => alert.answer !== null);
  if (alerts.length === 0) return null;
  return (
    <>
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.securityAlerts')}
      </AppText>
      {open.map((alert) => (
        <SurfaceCard key={alert.id}>
          <AlertSummary alert={alert} />
          {alert.signals.map((signal) => (
            <AppText key={signal} step="secondary">
              {`• ${t(`m.profile.alertSignal_${signal}`, { defaultValue: signal })}`}
            </AppText>
          ))}
          <AppText step="body">{t('m.profile.alertQuestion')}</AppText>
          <View style={styles.actions}>
            <Button label={t('m.profile.alertItWasMe')} variant="secondary" busy={busy} onPress={() => onAnswer(alert.id, 'it_was_me')} />
            <Button label={t('m.profile.alertNotMe')} variant="danger" busy={busy} onPress={() => onAnswer(alert.id, 'not_me')} />
          </View>
        </SurfaceCard>
      ))}
      {answered.length > 0 ? (
        <AppText step="secondary" tone="muted" accessibilityRole="header">
          {t('m.profile.earlierAlerts')}
        </AppText>
      ) : null}
      {answered.map((alert) => (
        <SurfaceCard key={alert.id}>
          <AlertSummary alert={alert} />
          <StatusTag
            tone={alert.answer === 'not_me' ? 'error' : 'neutral'}
            label={t(`m.profile.alertAnswered_${alert.answer}`)}
          />
        </SurfaceCard>
      ))}
    </>
  );
}

function AlertSummary({ alert }: { alert: SecurityAlert }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <>
      <AppText step="card">{t(`m.profile.alertKind_${alert.kind}`)}</AppText>
      <AppText step="secondary" tone="muted">
        {t('m.profile.alertWhen', { device: alert.deviceLabel, time: formatDateTime(alert.createdAt, language) })}
      </AppText>
    </>
  );
}

function PasswordChange() {
  const { t } = useTranslation();
  const { expire } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  // A new password ends every session, this one too (FR-AUTH-016), so the app returns to sign-in.
  const change = useApiAction(async () => {
    await api().changePassword(current, next);
    await expire();
  });
  const problem = problemsOf(change.error)[0];
  return (
    <SurfaceCard>
      <AppText step="section" accessibilityRole="header">
        {t('m.profile.changePassword')}
      </AppText>
      <TextField label={t('m.profile.currentPassword')} value={current} onChangeText={setCurrent} secret autoComplete="current-password" />
      <TextField
        label={t('m.profile.newPassword')}
        hint={t('m.register.passwordHint')}
        value={next}
        onChangeText={setNext}
        secret
        autoComplete="new-password"
        error={problem ? t(`m.problems.${problem}`, { defaultValue: t('m.errors.password_refused') }) : null}
      />
      {change.error && !problem ? <Notice tone="error">{errorMessage(t, change.error)}</Notice> : null}
      <Button
        label={t('m.profile.changePassword')}
        busy={change.busy}
        busyLabel={t('m.common.saving')}
        disabled={current === '' || next.length < 10}
        onPress={() => void change.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  actions: { gap: spacing[2] },
  flex: { flex: 1 },
});
