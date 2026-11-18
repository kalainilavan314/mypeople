import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProfileView } from '@my-people/api-client';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  confirmAction,
  Screen,
  StatusTag,
  type Tone,
  useApiQuery,
  useReloadOnFocus,
  useSession,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { clearFieldVisits } from '@/features/staff/fieldVisits/visitStore';
import { StaffRoleTags } from '@/features/staff/StaffRoleTags';
import { type MyStaffRoles, useMyStaffRoles } from '@/features/staff/useMyStaffRoles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { api } from '@/lib/api';

type IconName = ComponentProps<typeof Ionicons>['name'];

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
    if (!confirmed) return;
    // Field visits waiting on this phone are member data: none stays after signing out.
    await clearFieldVisits().catch(() => undefined);
    await signOut();
  };

  return (
    <Screen
      edges={[]}
      maxContentWidth={720}
      onRefresh={profile.reload}
      refreshing={profile.loading && profile.data !== undefined}>
      <QueryView query={profile}>{(data) => <ProfileHero data={data} roles={roles} />}</QueryView>

      <Section title={t('m.profile.account')}>
        <View style={styles.grid}>
          <ProfileCard icon="location-outline" label={t('m.profile.myArea')} href="/profile/area" />
          <ProfileCard icon="time-outline" label={t('m.profile.myActivity')} href="/profile/activity" />
          <ProfileCard icon="create-outline" label={t('m.profile.editProfile')} href="/profile/edit" />
          <ProfileCard icon="shield-checkmark-outline" label={t('m.profile.verification')} href="/verify" />
        </View>
      </Section>

      <Section title={t('m.profile.community')}>
        <View style={styles.grid}>
          <ProfileCard icon="home-outline" label={t('m.household.title')} href="/household" />
          <ProfileCard icon="people-outline" label={t('m.profile.hub')} href="/hub" />
          {/* OD-26: one app for members and staff; the Staff section for anyone the team assigned a role. */}
          {staff ? <ProfileCard icon="briefcase-outline" label={t('m.profile.staffSection')} href="/staff" /> : null}
        </View>
      </Section>

      <Section title={t('m.profile.settings')}>
        <View style={styles.settingsList}>
          <ProfileRow icon="language-outline" label={t('m.profile.preferences')} href="/profile/settings" first />
          <ProfileRow
            icon="call-outline"
            label={t('m.profile.recoveryNumber')}
            href={{ pathname: '/profile/recovery-number', params: { from: 'profile' } }}
          />
          <ProfileRow icon="lock-closed-outline" label={t('m.profile.security')} href="/profile/security" />
          <ProfileRow icon="document-lock-outline" label={t('m.profile.privacy')} href="/profile/privacy" />
        </View>
      </Section>

      <Pressable
        onPress={() => void confirmSignOut()}
        accessibilityRole="button"
        accessibilityLabel={t('m.common.signOut')}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
        <Ionicons name="log-out-outline" size={28} color={colors.primary} />
        <AppText step="section" tone="primary" style={styles.signOutLabel}>
          {t('m.common.signOut')}
        </AppText>
      </Pressable>
    </Screen>
  );
}

function ProfileHero({ data, roles }: { data: ProfileView; roles: MyStaffRoles }) {
  const { t } = useTranslation();
  const { largeText, stackHero } = useResponsiveLayout();
  const name = data.displayName ?? data.legalName;

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.hero, stackHero && styles.stackedHero]}>
      <View style={styles.heroYellow} />
      <Image
        source={require('../../../assets/brand/logo.png')}
        style={styles.heroLogo}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no"
      />
      <View style={[styles.heroTop, stackHero && styles.stackedHeroTop]}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <AppText step="page" tone="inverse" style={styles.avatarLetter}>
            {name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
        <View style={styles.identity}>
          <AppText
            step="page"
            tone="inverse"
            accessibilityRole="header"
            style={[styles.memberName, largeText && styles.largeTextMemberName]}>
            {name}
          </AppText>
          <AppText step="secondary" tone="inverse" mono style={styles.memberCode}>
            {data.memberCode}
          </AppText>
        </View>
      </View>
      <View style={[styles.statuses, stackHero && styles.stackedStatuses]}>
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
    </LinearGradient>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { largeText } = useResponsiveLayout();
  return (
    <View style={styles.section}>
      <AppText
        step="section"
        accessibilityRole="header"
        style={[styles.sectionTitle, largeText && styles.responsiveSectionTitle]}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function ProfileCard({ icon, label, href }: { icon: IconName; label: string; href: Href }) {
  const { stackCards, largeText } = useResponsiveLayout();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.profileCard, stackCards && styles.stackedProfileCard, pressed && styles.pressed]}>
      <View style={styles.cardAccent} />
      <Ionicons name={icon} size={34} color={colors.primary} />
      <AppText
        step="label"
        style={[styles.cardLabel, largeText && styles.largeTextCardLabel]}
        numberOfLines={stackCards ? undefined : 2}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={24} color={colors.text} />
    </Pressable>
  );
}

function ProfileRow({ icon, label, href, first = false }: { icon: IconName; label: string; href: Href; first?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.profileRow, !first && styles.rowDivider, pressed && styles.pressed]}>
      <Ionicons name={icon} size={30} color={colors.primary} />
      <AppText step="label" style={styles.rowLabel}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    minHeight: 190,
    borderRadius: radius.card,
    padding: spacing[4],
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  stackedHero: { minHeight: 0 },
  heroYellow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 8,
    backgroundColor: colors.brandYellow,
  },
  heroLogo: {
    position: 'absolute',
    width: 170,
    height: 170,
    right: -22,
    top: 10,
    tintColor: colors.onPrimary,
    opacity: 0.12,
  },
  heroTop: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stackedHeroTop: { alignItems: 'flex-start', flexDirection: 'column' },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(141, 10, 18, 0.34)',
  },
  avatarLetter: { fontSize: 38, lineHeight: 46, fontWeight: '700' },
  identity: { flex: 1, gap: spacing[1] },
  memberName: { fontSize: 29, lineHeight: 36, fontWeight: '700' },
  largeTextMemberName: { fontSize: 22, lineHeight: 32 },
  memberCode: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  statuses: { zIndex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingBottom: spacing[1] },
  stackedStatuses: { alignItems: 'flex-start', flexDirection: 'column' },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  responsiveSectionTitle: { fontSize: 20, lineHeight: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  profileCard: {
    position: 'relative',
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    minHeight: 82,
    padding: spacing[3],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    overflow: 'hidden',
  },
  stackedProfileCard: { flexBasis: '100%', width: '100%', minHeight: 76 },
  cardAccent: {
    position: 'absolute',
    right: -13,
    bottom: -17,
    width: 58,
    height: 42,
    borderTopLeftRadius: 48,
    backgroundColor: 'rgba(255, 211, 42, 0.46)',
  },
  cardLabel: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  largeTextCardLabel: { fontSize: 15, lineHeight: 24 },
  settingsList: {
    paddingHorizontal: spacing[3],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  profileRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowLabel: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  signOut: {
    minHeight: control.height + 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
  },
  signOutLabel: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
