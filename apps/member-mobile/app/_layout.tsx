import '@/lib/i18n';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { colors } from '@my-people/design-tokens/mobile';
import {
  AppTypographyProvider,
  DisplayPreferencesProvider,
  appFonts,
  readDisplayPreferences,
  SessionProvider,
  type StoredDisplayPreferences,
  useSession,
} from '@my-people/mobile-ui';

import { API_URL } from '@/lib/api';
import { restoreLanguage } from '@/lib/i18n';

// Keep the splash screen up until the locked fonts, the saved language, the
// display choices (M44) and the stored session are ready, so text never
// flashes in a different font, language or size and a signed-in member never
// sees the sign-in screen first.
SplashScreen.preventAutoHideAsync();

// The brand splash stays long enough to be seen, then fades into the app (none when the phone asks for less motion).
const SPLASH_MINIMUM_VISIBLE_MS = 800;
const SPLASH_FADE_MS = 300;
const splashStartedAt = Date.now();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const [languageReady, setLanguageReady] = useState(false);
  const [display, setDisplay] = useState<StoredDisplayPreferences | null | undefined>(undefined);

  useEffect(() => {
    restoreLanguage().finally(() => setLanguageReady(true));
    readDisplayPreferences().then(setDisplay, () => setDisplay(null));
  }, []);

  if (!(fontsLoaded || fontError !== null) || !languageReady || display === undefined) return null;

  return (
    <AppTypographyProvider scale="comfortable">
      <DisplayPreferencesProvider initial={display}>
        <SessionProvider baseUrl={API_URL}>
          <StatusBar style="dark" />
          <AppContent />
        </SessionProvider>
      </DisplayPreferencesProvider>
    </AppTypographyProvider>
  );
}

function AppContent() {
  const { state } = useSession();
  const loading = state.status === 'loading';
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const reduceMotionEnabled = useRef(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) reduceMotionEnabled.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionEnabled.current = enabled;
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    let active = true;
    let fadeAnimation: Animated.CompositeAnimation | undefined;
    const remaining = Math.max(0, SPLASH_MINIMUM_VISIBLE_MS - (Date.now() - splashStartedAt));

    const timer = setTimeout(() => {
      if (!active) return;
      void SplashScreen.hideAsync()
        .catch(() => {})
        .then(() => {
          if (!active) return;
          if (reduceMotionEnabled.current) {
            fadeAnim.setValue(0);
            setSplashAnimationDone(true);
            return;
          }
          fadeAnimation = Animated.timing(fadeAnim, {
            toValue: 0,
            duration: SPLASH_FADE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          });
          fadeAnimation.start(({ finished }) => {
            if (active && finished) setSplashAnimationDone(true);
          });
        });
    }, remaining);

    return () => {
      active = false;
      clearTimeout(timer);
      fadeAnimation?.stop();
    };
  }, [loading, fadeAnim]);

  if (loading && !splashAnimationDone) return null;
  const signedIn = state.status === 'signed_in';

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
        {/* Everything but the welcome, sign-in, registration and recovery screens needs a session. */}
        <Stack.Protected guard={signedIn} redirectTo="/welcome">
          <Stack.Screen name="(member)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>

      {!splashAnimationDone ? (
        <Animated.View style={[styles.splashOverlay, { opacity: fadeAnim }]}>
          <Image
            source={require('../assets/brand/splash-logo.png')}
            style={styles.splashImage}
            resizeMode="contain"
            accessible={false}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  // Over the app while it fades out; it never takes touches.
  splashOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    pointerEvents: 'none',
  },
  splashImage: { width: 200, height: 200 },
});
