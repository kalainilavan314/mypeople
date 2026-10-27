import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Signed-in screens: the five tabs, and the screens they open on top. */
export default function MemberLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ title: t('m.verify.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('m.inbox.title') }} />
      <Stack.Screen name="hub" options={{ title: t('m.home.hub') }} />
      <Stack.Screen name="events/[id]" options={{ title: t('m.events.details') }} />
      <Stack.Screen name="events/[id]/pass" options={{ title: t('m.events.passTitle') }} />
      <Stack.Screen name="gallery/[id]" options={{ title: t('m.gallery.title') }} />
      <Stack.Screen name="gallery/photo" options={{ title: t('m.gallery.title') }} />
      <Stack.Screen name="profile/edit" options={{ title: t('m.profile.editProfile') }} />
      <Stack.Screen name="profile/activity" options={{ title: t('m.profile.myActivity') }} />
      <Stack.Screen name="profile/area" options={{ title: t('m.profile.myArea') }} />
      <Stack.Screen name="profile/settings" options={{ title: t('m.profile.settings') }} />
      <Stack.Screen name="profile/security" options={{ title: t('m.profile.security') }} />
      <Stack.Screen name="profile/privacy" options={{ title: t('m.profile.privacy') }} />
      <Stack.Screen name="profile/recovery-number" options={{ title: t('m.profile.recoveryNumber') }} />
    </Stack>
  );
}
