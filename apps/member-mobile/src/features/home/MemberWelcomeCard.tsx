import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';
import { AppText, StatusTag } from '@my-people/mobile-ui';

export function MemberWelcomeCard({
  place,
  membershipState,
}: {
  place: string;
  membershipState: HomeView['membershipState'];
}) {
  const { t } = useTranslation();
  const membershipTone = membershipState === 'active' ? 'verified' : membershipState === 'pending' ? 'pending' : 'error';

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.hero}>
      <Image
        source={require('../../../assets/brand/logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no"
      />
      <View style={styles.content}>
        <AppText step="page" tone="inverse" accessibilityRole="header" style={styles.title}>
          {t('m.home.welcomeTitle')} 👋
        </AppText>
        <AppText step="label" tone="inverse" style={styles.subtitle}>
          {t('m.home.welcomeSubtitle')}
        </AppText>
        {place ? (
          <View style={styles.place}>
            <Ionicons name="location" size={21} color={colors.onPrimary} />
            <AppText step="secondary" tone="inverse" style={styles.placeText} numberOfLines={2}>
              {place}
            </AppText>
          </View>
        ) : null}

        <View style={styles.divider} />
        <View style={styles.membershipRow}>
          <View style={styles.membershipLabel}>
            <Ionicons name="card" size={22} color={colors.onPrimary} />
            <AppText step="label" tone="inverse">
              {t('m.profile.membership')}
            </AppText>
          </View>
          <StatusTag tone={membershipTone} label={t(`m.home.membership_${membershipState}`)} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    minHeight: 232,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  logo: {
    position: 'absolute',
    width: 196,
    height: 196,
    right: -22,
    top: 18,
    tintColor: colors.onPrimary,
    opacity: 0.14,
  },
  content: {
    flex: 1,
    zIndex: 1,
    padding: spacing[6],
    gap: spacing[2],
    justifyContent: 'center',
  },
  title: { fontSize: 34, lineHeight: 42, fontWeight: '700' },
  subtitle: { fontSize: 19, lineHeight: 28, fontWeight: '600' },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  placeText: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.42)', marginVertical: spacing[2] },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  membershipLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
