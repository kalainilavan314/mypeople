import type { ProfileView } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  confirmAction,
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
import { StaffRoleTags } from '@/features/staff/StaffRoleTags';
import { useMyStaffRoles } from '@/features/staff/useMyStaffRoles';
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
  const roles = useMyStaffRoles();
  const staff = roles.assignments.length > 0;

  // The web build has no Alert.alert; confirmAction uses the browser's own dialog there.
  const confirmSignOut = async () => {
    const confirmed = await confirmAction({
      title: t('m.common.signOut'),
      message: t('m.common.signOutConfirm'),
      confirmLabel: t('m.common.signOut'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) await signOut();
  };

  return (
    <Screen
      edges={[]}
      maxContentWidth={720}
      onRefresh={profile.reload}
      refreshing={profile.loading && profile.data !== undefined}>
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
              {/* The tier the team assigned, as soon as it counts (OD-26: one app for members and staff). */}
              <StaffRoleTags roles={roles} />
            </View>
          </SurfaceCard>
        )}
      </QueryView>

      <AppText step="section" accessibilityRole="header">
        {t('m.profile.account')}
      </AppText>
      <SurfaceCard>
        <MenuRow first icon="location-outline" label={t('m.profile.myArea')} onPress={() => router.push('/profile/area')} />
        <MenuRow icon="time-outline" label={t('m.profile.myActivity')} onPress={() => router.push('/profile/activity')} />
        <MenuRow icon="create-outline" label={t('m.profile.editProfile')} onPress={() => router.push('/profile/edit')} />
        <MenuRow icon="shield-checkmark-outline" label={t('m.profile.verification')} onPress={() => router.push('/verify')} />
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.profile.community')}
      </AppText>
      <SurfaceCard>
        <MenuRow first icon="home-outline" label={t('m.household.title')} onPress={() => router.push('/household')} />
        <MenuRow icon="people-outline" label={t('m.profile.hub')} onPress={() => router.push('/hub')} />
        {staff ? (
          <MenuRow icon="briefcase-outline" label={t('m.profile.staffSection')} onPress={() => router.push('/staff')} />
        ) : null}
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.profile.settings')}
      </AppText>
      <SurfaceCard>
        <MenuRow
          first
          icon="language-outline"
          label={t('m.profile.preferences')}
          onPress={() => router.push('/profile/settings')}
        />
        <MenuRow
          icon="call-outline"
          label={t('m.profile.recoveryNumber')}
          onPress={() => router.push({ pathname: '/profile/recovery-number', params: { from: 'profile' } })}
        />
        <MenuRow icon="lock-closed-outline" label={t('m.profile.security')} onPress={() => router.push('/profile/security')} />
        <MenuRow icon="document-lock-outline" label={t('m.profile.privacy')} onPress={() => router.push('/profile/privacy')} />
      </SurfaceCard>

      <Button label={t('m.common.signOut')} variant="danger" icon="log-out-outline" onPress={() => void confirmSignOut()} />
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
