import Ionicons from '@expo/vector-icons/Ionicons';
import type { HomeView } from '@my-people/api-client';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, StatusTag } from '@my-people/mobile-ui';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

/**
 * The owner's two Home pictures (25 November 2026), cross-fading every 4 seconds. Small bundled WebP
 * files (1440 × 600, under 100 KB), so a change never waits on the network. Decorative: screen
 * readers skip them. With "reduce motion" on, the first picture stays.
 */
const PHOTOS = [
  require('../../../assets/backgrounds/home-hero-1.webp'),
  require('../../../assets/backgrounds/home-hero-2.webp'),
] as const;

const INTERVAL_MS = 4000;
const FADE_MS = 800;

function useRotatingPhoto(count: number) {
  const [active, setActive] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacities = useRef(Array.from({ length: count }, (_, index) => new Animated.Value(index === 0 ? 1 : 0))).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setActive((current) => (current + 1) % count), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count, reduceMotion]);

  useEffect(() => {
    Animated.parallel(
      opacities.map((value, index) =>
        Animated.timing(value, { toValue: index === active ? 1 : 0, duration: FADE_MS, useNativeDriver: true }),
      ),
    ).start();
  }, [active, opacities]);

  return opacities;
}

export function MemberWelcomeCard({ membershipState }: { membershipState: HomeView['membershipState'] }) {
  const { t } = useTranslation();
  const { largeText, stackHero } = useResponsiveLayout();
  const opacities = useRotatingPhoto(PHOTOS.length);
  const membershipTone = membershipState === 'active' ? 'verified' : membershipState === 'pending' ? 'pending' : 'error';

  // A light veil (the owner asked for the pictures to show more), darker only behind the text so the
  // white words stay readable on the bright parts of the pictures.
  return (
    <View style={[styles.hero, stackHero && styles.stackedHero]}>
      <View style={styles.fill} accessible={false} importantForAccessibility="no-hide-descendants">
        {PHOTOS.map((source, index) => (
          <Animated.View key={index} style={[styles.fill, { opacity: opacities[index] }]}>
            <Image source={source} style={styles.photo} resizeMode="cover" accessible={false} />
          </Animated.View>
        ))}
      </View>
      <LinearGradient
        colors={['rgba(23, 41, 32, 0.58)', 'rgba(29, 48, 38, 0.26)', 'rgba(29, 48, 38, 0.04)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.fill}
      />
      <LinearGradient
        colors={['rgba(23, 41, 32, 0)', 'rgba(23, 41, 32, 0.55)']}
        locations={[0.35, 1]}
        style={styles.fill}
      />
      <View style={[styles.content, stackHero && styles.stackedContent]}>
        <AppText
          step="page"
          tone="inverse"
          accessibilityRole="header"
          style={[styles.title, styles.shadow, largeText && styles.largeTextTitle]}>
          {t('m.home.welcomeTitle')}
        </AppText>

        <View style={styles.divider} />
        <View style={[styles.membershipRow, stackHero && styles.stackedMembershipRow]}>
          <View style={styles.membershipLabel}>
            <Ionicons name="id-card-outline" size={iconSize.row} color={colors.onPrimary} />
            <AppText step="label" tone="inverse" style={styles.shadow}>
              {t('m.profile.membership')}
            </AppText>
          </View>
          <StatusTag tone={membershipTone} label={t(`m.home.membership_${membershipState}`)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    minHeight: 180,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.primaryDark,
  },
  stackedHero: { minHeight: 150 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // On the web a bundled image keeps its own pixel size unless the box is given explicitly.
  photo: { width: '100%', height: '100%' },
  content: {
    flex: 1,
    zIndex: 1,
    padding: spacing[5],
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  stackedContent: { padding: spacing[4] },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  largeTextTitle: { fontSize: 22, lineHeight: 31 },
  shadow: { textShadowColor: 'rgba(0, 0, 0, 0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.5)', marginVertical: spacing[2] },
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
