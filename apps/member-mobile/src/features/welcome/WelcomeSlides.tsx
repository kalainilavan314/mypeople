import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens/mobile';

/**
 * The welcome screen's pictures (owner's choice, 25 November 2026): three images in the flag's 2:1
 * frame, a gentle cross-fade every 5 seconds. They are bundled, small WebP files (about 30 KB each)
 * that all load at once, so a change never waits. Softened (a light blur and fade) so they sit
 * behind the names. Decorative: screen readers skip them. With "reduce motion" on, the first image
 * stays.
 */
const SLIDES = [
  require('../../../assets/brand/welcome/welcome-1.webp'),
  require('../../../assets/brand/welcome/welcome-2.webp'),
  require('../../../assets/brand/welcome/welcome-3.webp'),
] as const;

const INTERVAL_MS = 5000;
const FADE_MS = 900;

export function WelcomeSlides() {
  const [active, setActive] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacities = useRef(SLIDES.map((_, index) => new Animated.Value(index === 0 ? 1 : 0))).current;

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
    const timer = setInterval(() => setActive((current) => (current + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  useEffect(() => {
    const fades = opacities.map((value, index) =>
      Animated.timing(value, { toValue: index === active ? 1 : 0, duration: FADE_MS, useNativeDriver: true }),
    );
    Animated.parallel(fades).start();
  }, [active, opacities]);

  return (
    <View style={styles.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      {SLIDES.map((source, index) => (
        <Animated.View key={index} style={[styles.layer, { opacity: opacities[index] }]}>
          <Image source={source} style={styles.image} resizeMode="cover" blurRadius={1} accessible={false} />
        </Animated.View>
      ))}
      <View style={styles.dots} pointerEvents="none">
        {SLIDES.map((_, index) => (
          <View key={index} style={[styles.dot, index === active && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A 2:1 frame (where the flag was); on the web a bundled image otherwise keeps its own pixel height.
  frame: { width: '100%', aspectRatio: 2, overflow: 'hidden', backgroundColor: colors.card },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  image: { width: '100%', height: '100%', opacity: 0.88 },
  dots: {
    position: 'absolute',
    bottom: spacing[2],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.card, opacity: 0.6 },
  dotActive: { width: 18, opacity: 1 },
});
