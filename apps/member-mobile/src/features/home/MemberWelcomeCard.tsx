import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, StatusTag } from '@my-people/mobile-ui';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export function MemberWelcomeCard({
  place,
  membershipState,
}: {
  place: string;
  membershipState: HomeView['membershipState'];
}) {
  const { t } = useTranslation();
  const { largeText, stackHero } = useResponsiveLayout();
  const membershipTone = membershipState === 'active' ? 'verified' : membershipState === 'pending' ? 'pending' : 'error';

  // The sage design's hero: the lake photo under a dark sage veil that keeps the white text at AA.
  return (
    <ImageBackground
      source={require('../../../assets/backgrounds/palmyra-lake.jpg')}
      resizeMode="cover"
      imageStyle={styles.photo}
      style={[styles.hero, stackHero && styles.stackedHero]}>
      <LinearGradient
        colors={['rgba(23, 41, 32, 0.86)', 'rgba(29, 48, 38, 0.66)', 'rgba(29, 48, 38, 0.38)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.veil}
      />
      <View style={[styles.content, stackHero && styles.stackedContent]}>
        <AppText
          step="page"
          tone="inverse"
          accessibilityRole="header"
          style={[styles.title, largeText && styles.largeTextTitle]}>
          {t('m.home.welcomeTitle')}
        </AppText>
        <AppText step="label" tone="inverse" style={[styles.subtitle, largeText && styles.largeTextSubtitle]}>
          {t('m.home.welcomeSubtitle')}
        </AppText>
        {place ? (
          <View style={styles.place}>
            <Ionicons name="location-outline" size={iconSize.row} color={colors.onPrimary} />
            <AppText step="secondary" tone="inverse" style={styles.placeText} numberOfLines={2}>
              {place}
            </AppText>
          </View>
        ) : null}

        <View style={styles.divider} />
        <View style={[styles.membershipRow, stackHero && styles.stackedMembershipRow]}>
          <View style={styles.membershipLabel}>
            <Ionicons name="id-card-outline" size={iconSize.row} color={colors.onPrimary} />
            <AppText step="label" tone="inverse">
              {t('m.profile.membership')}
            </AppText>
          </View>
          <StatusTag tone={membershipTone} label={t(`m.home.membership_${membershipState}`)} />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    minHeight: 200,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.primaryDark,
  },
  stackedHero: { minHeight: 0 },
  // On the web a bundled image keeps its own pixel size unless the box is given explicitly.
  photo: { borderRadius: radius.card, width: '100%', height: '100%' },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  content: {
    flex: 1,
    zIndex: 1,
    padding: spacing[5],
    gap: spacing[2],
    justifyContent: 'center',
  },
  stackedContent: { padding: spacing[4], justifyContent: 'flex-start' },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  largeTextTitle: { fontSize: 22, lineHeight: 31 },
  subtitle: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  largeTextSubtitle: { fontSize: 15, lineHeight: 23 },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  placeText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.36)', marginVertical: spacing[2] },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  stackedMembershipRow: { alignItems: 'flex-start', flexDirection: 'column' },
  membershipLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
