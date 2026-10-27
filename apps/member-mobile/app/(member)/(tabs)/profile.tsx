import type { ProfileView } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';

import {
  AppText,
  Button,
  MenuRow,
  Screen,
  StatusTag,
  SurfaceCard,
  type Tone,
  useApiQuery,
  useReloadOnFocus,
  useSession,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

const IDENTITY_TONE: Record<ProfileView['identityState'], Tone> = {
  not_submitted: 'neutral',
  submitted: 'pending',
  in_review: 'pending',
  needs_update: 'pending',
  verified: 'verified',
  unable_to_verify: 'error',
};

const MEMBERSHIP_TONE: Record<ProfileView['membershipState'], Tone> = {
  pending: 'pending',
  active: 'verified',
  suspended: 'error',
  inactive: 'neutral',
};

/** P01: who the member is, identity and membership shown separately, and the way to everything personal. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const profile = useApiQuery(() => api().getProfile());
  useReloadOnFocus(profile.reload);

  return (
    <Screen edges={[]} onRefresh={profile.reload} refreshing={profile.loading && profile.data !== undefined}>
      <QueryView query={profile}>
        {(data) => (
          <SurfaceCard>
            <View style={styles.header}>
              <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                <AppText step="section" tone="inverse">
                  {(data.displayName ?? data.legalName).slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.headerText}>
                <AppText step="section" accessibilityRole="header">
                  {data.displayName ?? data.legalName}
                </AppText>
                {data.displayName ? (
                  <AppText step="secondary" tone="muted">{`${t('m.profile.legalName')}: ${data.legalName}`}</AppText>
                ) : null}
                <AppText step="secondary" tone="secondary" mono>
                  {data.memberCode}
                </AppText>
              </View>
            </View>
            <View style={styles.tags}>
              <StatusTag
                tone={IDENTITY_TONE[data.identityState]}
                label={`${t('m.profile.identity')}: ${t(`m.verify.status_${data.identityState}`)}`}
              />
              <StatusTag
                tone={MEMBERSHIP_TONE[data.membershipState]}
                label={`${t('m.profile.membership')}: ${t(`m.home.membership_${data.membershipState}`)}`}
              />
            </View>
          </SurfaceCard>
        )}
      </QueryView>

      <SurfaceCard>
        <MenuRow first icon="location-outline" label={t('m.profile.myArea')} onPress={() => router.push('/profile/area')} />
        <MenuRow icon="time-outline" label={t('m.profile.myActivity')} onPress={() => router.push('/profile/activity')} />
        <MenuRow icon="create-outline" label={t('m.profile.editProfile')} onPress={() => router.push('/profile/edit')} />
        <MenuRow icon="shield-checkmark-outline" label={t('m.profile.verification')} onPress={() => router.push('/verify')} />
        <MenuRow icon="people-outline" label={t('m.profile.hub')} onPress={() => router.push('/hub')} />
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.profile.settings')}
      </AppText>
      <SurfaceCard>
        <MenuRow
          first
          icon="language-outline"
          label={`${t('m.profile.language')} · ${t('m.profile.notifications')}`}
          onPress={() => router.push('/profile/settings')}
        />
        <MenuRow icon="call-outline" label={t('m.profile.recoveryNumber')} onPress={() => router.push('/profile/recovery-number')} />
        <MenuRow icon="lock-closed-outline" label={t('m.profile.security')} onPress={() => router.push('/profile/security')} />
        <MenuRow icon="document-lock-outline" label={t('m.profile.privacy')} onPress={() => router.push('/profile/privacy')} />
      </SurfaceCard>

      <Button label={t('m.common.signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
