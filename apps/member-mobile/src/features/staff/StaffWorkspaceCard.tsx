import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { colors, spacing, staffGlow } from '@my-people/design-tokens/mobile';
import { AppText, useLanguage } from '@my-people/mobile-ui';

import { areaLabel, tierLabel } from '@/features/staff/areaLabel';
import type { MyStaffRoles } from '@/features/staff/useMyStaffRoles';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const RADIUS = 20;
const EDGE = 2;
/** One full turn of the neon edge. */
const TURN_MS = 8000;
/** The sparkle plays once per app session, the first time the card appears. */
let introPlayed = false;

/**
 * The way into the Staff section for someone with a staff role, in the style of the owner's
 * reference video (26 November 2026): a white card inside a fine multicolour edge that keeps
 * moving round it, with a soft coloured glow (owner, 26 November: no green fill, kept professional), and a gold sparkle that pops in beside the badge the
 * first time it appears. Text and tap work from the first frame; nothing waits on an animation.
 * With "reduce motion" on, the edge stays still and a press only changes the colour. The section
 * itself still asks for the authenticator code, and the API checks the role on every staff request.
 */
export function StaffWorkspaceCard({ roles }: { roles: MyStaffRoles }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const reduceMotion = useReduceMotion();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const press = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(1)).current;

  const title = t('m.home.staffWorkspace');
  const roleLines = roles.assignments.map(
    (assignment) => `${tierLabel(assignment, language)} · ${areaLabel(assignment, roles.areaNames, language)}`,
  );

  // The neon edge turns slowly and the glow breathes, for as long as the card is on screen.
  useEffect(() => {
    if (reduceMotion !== false) return;
    const loop = Animated.parallel([
      Animated.loop(Animated.timing(turn, { toValue: 1, duration: TURN_MS, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 0.7, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ]);
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, turn, glow]);

  // The sparkle: pops in (0 → 1), turns, then fades (1 → 2); about 1.2 s.
  useEffect(() => {
    if (reduceMotion !== false || introPlayed) return;
    introPlayed = true;
    Animated.sequence([
      Animated.delay(150),
      Animated.timing(sparkle, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(sparkle, { toValue: 2, duration: 370, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, sparkle]);

  function animatePress(toValue: 0 | 1) {
    if (reduceMotion) return;
    Animated.spring(press, { toValue, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  }

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  }

  // The gradient is a square as wide as the card's diagonal, turning behind the card, so its colours
  // pass along every edge of the 2 px ring the card leaves uncovered.
  const diagonal = size ? Math.ceil(Math.hypot(size.width, size.height)) + 4 : 0;

  return (
    <Pressable
      // Navigation happens on release, straight away; the animations only decorate.
      onPress={() => router.push('/staff')}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      accessibilityRole="link"
      accessibilityLabel={[title, ...roleLines].join('. ')}>
      {({ pressed }) => (
        <Animated.View
          style={[styles.outer, { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) }] }]}>
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />

          <View style={styles.ring} onLayout={onLayout}>
            {size ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.spinner,
                  {
                    width: diagonal,
                    height: diagonal,
                    left: (size.width - diagonal) / 2,
                    top: (size.height - diagonal) / 2,
                    transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                  },
                ]}>
                <LinearGradient colors={staffGlow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            ) : null}

            <View style={[styles.card, reduceMotion && pressed && styles.pressedColour]}>
              <View style={styles.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Ionicons name="id-card-outline" size={26} color={colors.primary} />
              </View>

              <View style={styles.copy}>
                <AppText step="section" style={styles.title}>
                  {title}
                </AppText>
                {roleLines.map((line) => (
                  <AppText key={line} step="secondary" tone="secondary">
                    {line}
                  </AppText>
                ))}
              </View>

              <Animated.View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                style={{ transform: [{ translateX: press.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }}>
                <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
              </Animated.View>
            </View>
          </View>

          <Animated.View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.sparkle,
              {
                opacity: sparkle.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
                transform: [
                  { scale: sparkle.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 1.15, 0.6] }) },
                  { rotate: sparkle.interpolate({ inputRange: [0, 2], outputRange: ['-30deg', '60deg'] }) },
                ],
              },
            ]}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path
                d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z"
                fill={colors.highlightGold}
                stroke={colors.card}
                strokeWidth={1}
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  // The soft coloured light round the card, like the reference video's glow.
  glow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: RADIUS,
    boxShadow:
      '0 -3px 14px rgba(236, 72, 153, 0.28), -4px 0 16px rgba(59, 130, 246, 0.28), 4px 0 16px rgba(139, 92, 246, 0.28), 0 5px 16px rgba(242, 201, 76, 0.24)',
  },
  ring: {
    borderRadius: RADIUS,
    padding: EDGE,
    overflow: 'hidden',
    backgroundColor: staffGlow[2],
  },
  spinner: { position: 'absolute' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 72,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: RADIUS - EDGE,
    backgroundColor: colors.card,
  },
  pressedColour: { backgroundColor: colors.surfaceVariant },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  // Beside the badge's top-right corner.
  sparkle: { position: 'absolute', top: 4, left: spacing[4] + EDGE + 40 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: '700' },
});
