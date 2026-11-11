import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';
import { spacing } from '@my-people/design-tokens/mobile';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * FR-STF-010 (self-service part): the devices signed in to this staff
 * account, and signing out a lost one from here. The server refuses that
 * device's next request, and the app on it then deletes its tokens and saved
 * data (clearSession), so nothing stays usable on a lost phone. Signing out
 * another person's device needs a permission the BRD has not named yet.
 */
export default function SessionsScreen() {
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
      <AppText step="secondary" tone="muted">
        {t('s.sessions.hint')}
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
                  {session.current ? <StatusTag tone="verified" label={t('s.sessions.thisDevice')} /> : null}
                </View>
                <AppText step="secondary" tone="muted">
                  {t('s.sessions.lastUsed', { time: formatDateTime(session.lastSeenAt, language) })}
                </AppText>
                {!session.current ? (
                  <Button
                    label={t('s.sessions.signOutDevice')}
                    variant="secondary"
                    busy={revoke.busy}
                    onPress={() => void revoke.run(session.id)}
                  />
                ) : null}
              </SurfaceCard>
            ))}
            {list.some((session) => !session.current) ? (
              <Button
                label={t('s.sessions.signOutOthers')}
                variant="danger"
                busy={revokeOthers.busy}
                onPress={() => void revokeOthers.run()}
              />
            ) : (
              <Notice tone="info">{t('s.sessions.onlyThis')}</Notice>
            )}
          </>
        )}
      </QueryView>
      {revoke.error || revokeOthers.error ? <Notice tone="error">{errorMessage(t, revoke.error ?? revokeOthers.error)}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
