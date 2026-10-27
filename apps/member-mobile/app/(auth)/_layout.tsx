import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';

export const unstable_settings = { initialRouteName: 'welcome' };

/** Screens before sign-in: welcome and language (A01), sign-in (A02), registration (A03), recovery (A13, A16). */
export default function AuthLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: t('m.signIn.title') }} />
      <Stack.Screen name="register" options={{ title: t('m.register.title') }} />
      <Stack.Screen name="recover" options={{ title: t('m.recover.title') }} />
      <Stack.Screen name="assisted-recovery" options={{ title: t('m.recover.assistedTitle') }} />
    </Stack>
  );
}
