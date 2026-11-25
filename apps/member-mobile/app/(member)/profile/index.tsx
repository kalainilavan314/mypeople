import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProfileView } from '@my-people/api-client';
import { router, type Href } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, iconSize, radius, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  confirmAction,
  IconTile,
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
        <Ionicons name="log-out-outline" size={iconSize.header} color={colors.primary} />
        <AppText step="section" tone="primary" style={styles.signOutLabel}>
          {t('m.common.signOut')}
        </AppText>
      </Pressable>
    </Screen>
  );
}

// The cover picture (owner's flag image, 26 November 2026) is already cut to the arch, with a round
// opening at the bottom centre for the avatar; these are that opening's centre and size as shares
// of the picture, so the avatar fills it at every width.
const COVER_RATIO = 793 / 543;
const AVATAR_CENTRE_Y = 0.924;
const AVATAR_WIDTH_SHARE = 0.216;

function ProfileHero({ data, roles }: { data: ProfileView; roles: MyStaffRoles }) {
  const { t } = useTranslation();
  const { largeText } = useResponsiveLayout();
  const name = data.displayName ?? data.legalName;
  const [coverWidth, setCoverWidth] = useState(0);
  const coverHeight = coverWidth / COVER_RATIO;
  const avatarSize = Math.round(coverWidth * AVATAR_WIDTH_SHARE);
  const avatarTop = coverHeight * AVATAR_CENTRE_Y - avatarSize / 2;

  return (
    <View style={styles.hero}>
      <View style={styles.cover} onLayout={(event) => setCoverWidth(event.nativeEvent.layout.width)}>
        <Image
          source={require('../../../assets/backgrounds/profile-cover.webp')}
          style={styles.coverImage}
          resizeMode="cover"
          accessible={false}
          importantForAccessibility="no"
        />
        {coverWidth > 0 ? (
          <View
            style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, top: avatarTop }]}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <AppText step="page" tone="inverse" style={[styles.avatarLetter, { fontSize: avatarSize * 0.46, lineHeight: avatarSize * 0.6 }]}>
              {name.slice(0, 1).toUpperCase()}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={[styles.identity, { marginTop: Math.max(0, avatarTop + avatarSize - coverHeight) + spacing[2] }]}>
        <AppText
          step="page"
          accessibilityRole="header"
          style={[styles.memberName, largeText && styles.largeTextMemberName]}>
          {name}
        </AppText>
        <AppText step="secondary" mono style={styles.memberCode}>
          {data.memberCode}
        </AppText>
      </View>
      <View style={styles.statuses}>
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
    </View>
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
      <IconTile icon={icon} tint="brand" size={40} />
      <AppText
        step="label"
        style={[styles.cardLabel, largeText && styles.largeTextCardLabel]}
        numberOfLines={stackCards ? undefined : 2}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={iconSize.chevron} color={colors.controlBorder} style={styles.chevron} />
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
      <IconTile icon={icon} tint="brand" size={40} />
      <AppText step="label" style={styles.rowLabel}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={iconSize.chevron} color={colors.controlBorder} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing[2] },
  // The arch keeps the picture's own shape; it never grows past a comfortable size on wide screens.
  cover: { width: '100%', maxWidth: 460, aspectRatio: COVER_RATIO },
  coverImage: { width: '100%', height: '100%' },
  avatar: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 4,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarLetter: { fontWeight: '700' },
  identity: { alignItems: 'center', gap: spacing[1] },
  memberName: { fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  largeTextMemberName: { fontSize: 22, lineHeight: 32 },
  memberCode: { fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2] },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  responsiveSectionTitle: { fontSize: 18, lineHeight: 27 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  profileCard: {
    position: 'relative',
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    minHeight: 72,
    padding: spacing[3],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  stackedProfileCard: { flexBasis: '100%', width: '100%', minHeight: 64 },
  cardLabel: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  largeTextCardLabel: { fontSize: 15, lineHeight: 23 },
  chevron: { flexShrink: 0 },
  settingsList: {
    paddingHorizontal: spacing[3],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  profileRow: {
    minHeight: 60,
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowLabel: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  signOut: {
    minHeight: control.height,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
  },
  signOutLabel: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
