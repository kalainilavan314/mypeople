import '@/lib/i18n';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { colors } from '@my-people/design-tokens';
import { AppTypographyProvider, lockedFonts, SessionProvider, useSession } from '@my-people/mobile-ui';

import { API_URL } from '@/lib/api';
import { restoreLanguage } from '@/lib/i18n';

// Keep the splash screen up until the locked fonts, the saved language and the
// stored session are ready, so text never flashes in a different font or
// language and a signed-in member never sees the sign-in screen first.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(lockedFonts);
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    restoreLanguage().finally(() => setLanguageReady(true));
  }, []);

  if (!(fontsLoaded || fontError !== null) || !languageReady) return null;

  return (
    <AppTypographyProvider scale="comfortable">
      <SessionProvider baseUrl={API_URL}>
        <StatusBar style="dark" />
        <Routes />
      </SessionProvider>
    </AppTypographyProvider>
  );
}

function Routes() {
  const { state } = useSession();
  const loading = state.status === 'loading';

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;
  const signedIn = state.status === 'signed_in';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}>
      {/* Everything but the welcome, sign-in, registration and recovery screens needs a session. */}
      <Stack.Protected guard={signedIn} redirectTo="/welcome">
        <Stack.Screen name="(member)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
