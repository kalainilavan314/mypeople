import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
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

/** Signed-in devices with sign-out per device (FR-AUTH-020, 021), and changing the password with the current one. */
export default function SecurityScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const sessions = useApiQuery(() => api().listMySessions());
  const revoke = useApiAction(async (id: string) => {
    await api().revokeSession(id);
    sessions.reload();
  });
  const revokeOthers = useApiAction(async () => {
    await api().revokeOtherSessions();
    sessions.reload();
  });

  return (
    <Screen edges={['bottom']} onRefresh={sessions.reload} refreshing={sessions.loading && sessions.data !== undefined}>
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
                  <Button label={t('m.profile.signOutDevice')} variant="secondary" busy={revoke.busy} onPress={() => void revoke.run(session.id)} />
                ) : null}
              </SurfaceCard>
            ))}
            {list.some((session) => !session.current) ? (
              <Button label={t('m.profile.signOutOthers')} variant="danger" busy={revokeOthers.busy} onPress={() => void revokeOthers.run()} />
            ) : null}
          </>
        )}
      </QueryView>
      {revoke.error || revokeOthers.error ? <Notice tone="error">{errorMessage(t, revoke.error ?? revokeOthers.error)}</Notice> : null}
      <PasswordChange />
    </Screen>
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
  flex: { flex: 1 },
});
