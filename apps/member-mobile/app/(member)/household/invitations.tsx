import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Notice,
  Screen,
  SurfaceCard,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Screen M09: Household invitation response
 * BRD v1.1 SC-22, FR-HH-006, BR-099; MP-FEA-002 §4.1.
 * The adult accepts or declines; they join, with the relationship, only after accepting.
 * Accepting needs a verified identity (M06). The head sees and can withdraw what they sent.
 */
export default function HouseholdInvitationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const invitationsQuery = useApiQuery(() => api().getMyInvitations());

  const respond = useApiAction(async (invitationId: string, action: 'accept' | 'decline') => {
    await api().respondInvitation(invitationId, { action });
    if (action === 'accept') {
      router.replace('/household');
    } else {
      void invitationsQuery.reload();
    }
  });

  const revoke = useApiAction(async (invitationId: string) => {
    await api().revokeInvitation(invitationId);
    void invitationsQuery.reload();
  });

  const confirmRevoke = (invitationId: string) => {
    const title = t('m.household.revoke');
    const message = t('m.household.revokeConfirm');
    const run = () => void revoke.run(invitationId);
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${title}\n\n${message}`)) run();
      return;
    }
    Alert.alert(title, message, [
      { text: t('m.common.cancel'), style: 'cancel' },
      { text: title, style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={invitationsQuery.reload}
      refreshing={invitationsQuery.loading && invitationsQuery.data !== undefined}>
      <QueryView query={invitationsQuery}>
        {(data) => {
          const hasReceived = data.received.length > 0;
          const hasSent = data.sent.length > 0;

          if (!hasReceived && !hasSent) {
            return (
              <SurfaceCard>
                <AppText step="body" style={styles.emptyText}>
                  {t('m.household.noInvitations')}
                </AppText>
              </SurfaceCard>
            );
          }

          return (
            <View style={styles.container}>
              {/* Received Invitations */}
              {hasReceived && (
                <View style={styles.section}>
                  <AppText step="section" accessibilityRole="header">
                    {t('m.household.receivedInvitations')} ({data.received.length})
                  </AppText>

                  {respond.error ? (
                    <View style={styles.topMargin}>
                      <Notice tone="error">
                        {errorMessage(t, respond.error)}
                      </Notice>
                    </View>
                  ) : null}

                  {data.received.map((inv) => (
                    <SurfaceCard key={inv.id} style={styles.inviteCard}>
                      <View style={styles.cardHeader}>
                        <AppText step="body" style={styles.householdName}>
                          {inv.householdName || t('m.household.title')}
                        </AppText>
                        <AppText step="caption" style={styles.inviterName}>
                          {inv.inviterName}
                        </AppText>
                      </View>

                      <AppText step="caption" style={styles.metaText}>
                        {t(`m.household.relationships.${inv.relationship}` as const, inv.relationship)}
                      </AppText>

                      <View style={styles.buttonRow}>
                        <View style={styles.flexOne}>
                          <Button
                            label={t('m.household.decline')}
                            variant="secondary"
                            busy={respond.busy}
                            onPress={() => void respond.run(inv.id, 'decline')}
                          />
                        </View>
                        <View style={styles.flexOne}>
                          <Button
                            label={t('m.household.accept')}
                            busy={respond.busy}
                            onPress={() => void respond.run(inv.id, 'accept')}
                          />
                        </View>
                      </View>
                    </SurfaceCard>
                  ))}
                </View>
              )}

              {/* Sent Invitations */}
              {hasSent && (
                <View style={styles.section}>
                  <AppText step="section" accessibilityRole="header">
                    {t('m.household.sentInvitations')} ({data.sent.length})
                  </AppText>

                  {revoke.error ? (
                    <View style={styles.topMargin}>
                      <Notice tone="error">
                        {errorMessage(t, revoke.error)}
                      </Notice>
                    </View>
                  ) : null}

                  {data.sent.map((inv) => (
                    <SurfaceCard key={inv.id} style={styles.inviteCard}>
                      {/* M08: the member code the head typed; never the invitee's name before they accept. */}
                      <View style={styles.cardHeader}>
                        <AppText step="body" style={styles.householdName} mono>
                          {inv.inviteeCode || ''}
                        </AppText>
                      </View>

                      <AppText step="caption" style={styles.metaText}>
                        {t(`m.household.relationships.${inv.relationship}` as const, inv.relationship)}
                      </AppText>

                      <View style={styles.topMargin}>
                        <Button
                          label={t('m.household.revoke')}
                          variant="danger"
                          busy={revoke.busy}
                          onPress={() => confirmRevoke(inv.id)}
                        />
                      </View>
                    </SurfaceCard>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[6],
  },
  section: {
    gap: spacing[2],
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  inviteCard: {
    gap: spacing[1],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  householdName: {
    fontWeight: '700',
  },
  inviterName: {
    color: colors.primary,
    fontWeight: '600',
  },
  metaText: {
    color: colors.textSecondary,
    marginBottom: spacing[1],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  flexOne: {
    flex: 1,
  },
  topMargin: {
    marginTop: spacing[2],
  },
});
