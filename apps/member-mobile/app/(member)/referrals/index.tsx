import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { api } from '@/lib/api';

/**
 * H20 My invitations: each invitation as "Invitation 01" with Shared, Pending or Active only; never
 * who joined (FR-REF-005, OD-24). Invitations earn no rewards, rank or permissions (FR-REF-006).
 */
export default function MyInvitationsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const referrals = useApiQuery(() => api().getMyReferrals());
  useReloadOnFocus(referrals.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={referrals.reload}
      refreshing={referrals.loading && referrals.data !== undefined}>
      <FeatureQueryView feature="referrals" query={referrals}>
        {(data) => (
          <>
            <Notice tone="info">{t('m.referrals.noRewards')}</Notice>
            <AppText step="body" tone="secondary">
              {t('m.referrals.listIntro')}
            </AppText>
            {data.invitations.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.referrals.none')}
              </AppText>
            ) : (
              <SurfaceCard style={styles.list}>
                {data.invitations.map((invitation, index) => {
                  const name = t('m.referrals.invitationNumber', { number: String(invitation.number).padStart(2, '0') });
                  const status = t(`m.referrals.status_${invitation.status}`);
                  return (
                    <View
                      key={invitation.number}
                      accessible
                      accessibilityLabel={`${name}. ${status}. ${formatDate(invitation.createdAt, language)}`}
                      style={[styles.item, index > 0 && styles.divider]}>
                      <View style={styles.flex}>
                        <AppText step="card">{name}</AppText>
                        <AppText step="caption" tone="muted">
                          {formatDate(invitation.createdAt, language)}
                        </AppText>
                      </View>
                      <StatusTag tone="neutral" label={status} />
                    </View>
                  );
                })}
              </SurfaceCard>
            )}
            <AppText step="caption" tone="muted">
              {t('m.referrals.statusHelp')}
            </AppText>
            <Button label={t('m.referrals.inviteSomeone')} icon="person-add-outline" onPress={() => router.push('/referrals/invite')} />
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  flex: { flex: 1, gap: 2 },
});
