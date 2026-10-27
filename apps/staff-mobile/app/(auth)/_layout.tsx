import { Stack } from 'expo-router';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';

export const unstable_settings = { anchor: 'sign-in' };

/** S01: staff sign in with their own member account; the second factor follows. */
export default function AuthLayout() {
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
}
