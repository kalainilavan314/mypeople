import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SecurityAlert, SecurityAlertAnswer } from '@my-people/api-client';
import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';

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
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={reload}
      refreshing={sessions.loading && sessions.data !== undefined}>
      {secured ? <Notice tone="success">{t('m.profile.alertSecured')}</Notice> : null}
      <QueryView query={alerts}>
        {(list) => <SecurityAlerts alerts={list} busy={answer.busy} onAnswer={(id, reply) => void answer.run(id, reply)} />}
      </QueryView>
      {answer.error ? <Notice tone="error">{errorMessage(t, answer.error)}</Notice> : null}
      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.profile.sessions')}
      </AppText>
      <QueryView query={sessions}>
        {(list) => (
          <>
            {list.length > 0 ? (
              <SurfaceCard style={styles.sessionsCard}>
                {list.map((session, index) => (
                  <View key={session.id} style={[styles.session, index > 0 && styles.sessionDivider]}>
                    <View style={styles.deviceIcon}>
                      <Ionicons
                        name="phone-portrait-outline"
                        size={29}
                        color={colors.primary}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                    </View>
                    <View style={styles.sessionCopy}>
                      <AppText step="card" style={styles.sessionTitle}>
                        {session.deviceLabel}
                      </AppText>
                      <AppText step="secondary" tone="muted">
                        {t('m.profile.lastUsed', { time: formatDateTime(session.lastSeenAt, language) })}
                      </AppText>
                    </View>
                    {session.current ? (
                      <StatusTag tone="verified" label={t('m.profile.thisDevice')} />
                    ) : (
                      <Pressable
                        onPress={() => confirmRevoke(session.id, session.deviceLabel)}
                        disabled={revoke.busy}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('m.profile.signOutDevice')}: ${session.deviceLabel}`}
                        style={({ pressed }) => [styles.compactAction, pressed && styles.pressed, revoke.busy && styles.disabled]}>
                        {revoke.busy ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <AppText step="label" tone="primary">{t('m.profile.signOutDevice')}</AppText>
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </SurfaceCard>
            ) : (
              <AppText step="secondary" tone="muted">
                {t('m.common.empty')}
              </AppText>
            )}
            {list.some((session) => !session.current) ? (
              <Button
                label={t('m.profile.signOutOthers')}
                variant="danger"
                icon="log-out-outline"
                busy={revokeOthers.busy}
                onPress={confirmOthers}
              />
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
      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.profile.securityAlerts')}
      </AppText>
      {open.map((alert) => (
        <SurfaceCard key={alert.id} style={styles.alertCard}>
          <View style={styles.cardAccent} />
          <View style={styles.alertHeader}>
            <View style={styles.alertIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={31}
                color={colors.primary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <View style={styles.flex}>
              <AlertSummary alert={alert} />
              {alert.signals.map((signal) => (
                <View key={signal} style={styles.signalRow}>
                  <View style={styles.signalDot} />
                  <AppText step="secondary" tone="secondary" style={styles.flex}>
                    {t(`m.profile.alertSignal_${signal}`, { defaultValue: signal })}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.alertDivider} />
          <AppText step="body">{t('m.profile.alertQuestion')}</AppText>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label={t('m.profile.alertItWasMe')} variant="secondary" busy={busy} onPress={() => onAnswer(alert.id, 'it_was_me')} />
            </View>
            <View style={styles.flex}>
              <Button label={t('m.profile.alertNotMe')} variant="primary" busy={busy} onPress={() => onAnswer(alert.id, 'not_me')} />
            </View>
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
          <View style={styles.alertHeader}>
            <View style={styles.alertIcon}>
              <Ionicons name="shield-checkmark-outline" size={31} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <AlertSummary alert={alert} />
            </View>
          </View>
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
      <AppText step="card" style={styles.alertTitle}>{t(`m.profile.alertKind_${alert.kind}`)}</AppText>
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
    <>
      <AppText step="section" accessibilityRole="header" style={styles.sectionTitle}>
        {t('m.profile.changePassword')}
      </AppText>
      <SurfaceCard style={styles.passwordCard}>
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
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  alertCard: { position: 'relative', overflow: 'hidden' },
  cardAccent: {
    position: 'absolute',
    width: 92,
    height: 64,
    right: -18,
    top: 72,
    borderTopLeftRadius: 64,
    backgroundColor: 'rgba(255, 211, 42, 0.42)',
  },
  alertHeader: { zIndex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  alertIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.card,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  signalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  alertDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing[1] },
  actions: { flexDirection: 'row', gap: spacing[3] },
  flex: { flex: 1 },
  sessionsCard: { padding: 0, gap: 0, overflow: 'hidden' },
  session: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  sessionDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  deviceIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCopy: { flex: 1, gap: 1 },
  sessionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  compactAction: {
    minWidth: 82,
    minHeight: control.touchMin,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordCard: { gap: spacing[4] },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});
