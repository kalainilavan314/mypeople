import type { ProfileView } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import {
  AppText,
  Button,
  LanguageToggle,
  MenuRow,
  Screen,
  StatusTag,
  SurfaceCard,
  type Tone,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
  useSession,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { useHasStaffRole } from '@/features/staff/useHasStaffRole';
import { api } from '@/lib/api';
import { chooseLanguage } from '@/lib/i18n';

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
  const language = useLanguage();
  const { signOut } = useSession();
  const profile = useApiQuery(() => api().getProfile());
  useReloadOnFocus(profile.reload);
  const staff = useHasStaffRole();

  return (
    <Screen edges={[]} onRefresh={profile.reload} refreshing={profile.loading && profile.data !== undefined}>
      <QueryView query={profile}>
        {(data) => {
          const name = data.displayName ?? data.legalName;
          return (
            <View style={styles.header}>
              <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                <AppText step="display" tone="inverse">
                  {name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.headerText}>
                <AppText step="section" accessibilityRole="header">
                  {name}
                </AppText>
                <AppText step="body" tone="muted">
                  {`${data.memberCode} · ${t('m.profile.member')}`}
                </AppText>
                {data.districtName ? (
                  <AppText step="body" tone="muted">
                    {data.districtName}
                  </AppText>
                ) : null}
                <View style={styles.tags}>
                  <StatusTag tone={MEMBERSHIP_TONE[data.membershipState]} label={t(`m.home.membership_${data.membershipState}`)} />
                  {data.identityState === 'verified' ? null : (
                    <StatusTag
                      tone={IDENTITY_TONE[data.identityState]}
                      label={`${t('m.profile.identity')}: ${t(`m.verify.status_${data.identityState}`)}`}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        }}
      </QueryView>

      <SurfaceCard style={styles.group}>
        <MenuRow first icon="create-outline" label={t('m.profile.editProfile')} onPress={() => router.push('/profile/edit')} />
        <MenuRow icon="shield-checkmark-outline" label={t('m.profile.verificationDetails')} onPress={() => router.push('/verify')} />
        <MenuRow icon="time-outline" label={t('m.profile.myActivity')} onPress={() => router.push('/profile/activity')} />
        <MenuRow icon="people-outline" label={t('m.profile.hub')} onPress={() => router.push('/hub')} />
        <MenuRow icon="map-outline" label={t('m.profile.myArea')} onPress={() => router.push('/profile/area')} />
        <MenuRow icon="home-outline" label={t('m.household.title')} onPress={() => router.push('/household')} />
        {staff ? (
          <MenuRow icon="briefcase-outline" label={t('m.profile.staffSection')} onPress={() => router.push('/staff')} />
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.group}>
        <MenuRow
          first
          icon="language-outline"
          label={t('m.profile.language')}
          trailing={<LanguageToggle value={language} onChange={(next) => void chooseLanguage(next)} label={t('m.profile.language')} />}
        />
        <MenuRow icon="settings-outline" label={t('m.profile.accountSettings')} onPress={() => router.push('/profile/settings')} />
      </SurfaceCard>

      <Button label={t('m.common.signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing[4], alignItems: 'center', paddingVertical: spacing[2] },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
  // Grouped rows sit closer to the card's edge than ordinary card content.
  group: { paddingVertical: spacing[1] },
});
