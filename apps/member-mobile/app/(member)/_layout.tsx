import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { headerOptions, useLanguage } from '@my-people/mobile-ui';
import { api } from '@/lib/api';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Signed-in screens: the five tabs, and the screens they open on top. */
export default function MemberLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  useEffect(() => {
    // A18: progress comes from the API, so a stale device can never choose a
    // completed step or bypass consent locally.
    void api().getMyRegistrationProgress().then((progress) => {
      if (progress.nextStep || progress.reviewState === 'needs_update') router.replace('/setup');
    }).catch(() => {
      // The destination remains usable when the network is temporarily down.
    });
  }, []);
  return (
    <Stack screenOptions={headerOptions(language, 'comfortable')}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ title: t('m.verify.title') }} />
      <Stack.Screen name="verify/appeal" options={{ title: t('m.verify.appealTitle') }} />
      <Stack.Screen name="card/code" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="card/progress" options={{ title: t('m.card.progressTitle') }} />
      <Stack.Screen name="card/share" options={{ title: t('m.card.shareTitle') }} />
      <Stack.Screen name="setup/index" options={{ title: t('m.setup.title') }} />
      <Stack.Screen name="setup/survey" options={{ title: t('m.setup.surveyTitle') }} />
      <Stack.Screen name="notifications" options={{ title: t('m.inbox.title') }} />
      <Stack.Screen name="hub" options={{ title: t('m.home.hub') }} />
      <Stack.Screen name="events/[id]" options={{ title: t('m.events.details') }} />
      <Stack.Screen name="events/[id]/pass" options={{ title: t('m.events.passTitle') }} />
      <Stack.Screen name="gallery/[id]" options={{ title: t('m.gallery.title') }} />
      <Stack.Screen name="gallery/photo" options={{ title: t('m.gallery.title') }} />
      <Stack.Screen name="profile/index" options={{ title: t('m.profile.title') }} />
      <Stack.Screen name="profile/edit" options={{ title: t('m.profile.editProfile') }} />
      <Stack.Screen name="profile/activity" options={{ title: t('m.profile.myActivity') }} />
      <Stack.Screen name="profile/area" options={{ title: t('m.profile.myArea') }} />
      <Stack.Screen name="profile/settings" options={{ title: t('m.profile.settings') }} />
      <Stack.Screen name="profile/security" options={{ title: t('m.profile.security') }} />
      <Stack.Screen name="profile/privacy" options={{ title: t('m.profile.privacy') }} />
      <Stack.Screen name="profile/recovery-number" options={{ title: t('m.profile.recoveryNumber') }} />
      <Stack.Screen name="household/index" options={{ title: t('m.household.title') }} />
      <Stack.Screen name="household/add" options={{ title: t('m.household.addMember') }} />
      <Stack.Screen name="household/invite" options={{ title: t('m.household.inviteAdult') }} />
      <Stack.Screen name="household/invitations" options={{ title: t('m.household.pendingInvitations') }} />
      <Stack.Screen name="household/privacy" options={{ title: t('m.household.privacyConsent') }} />
      <Stack.Screen name="fund/index" options={{ title: t('m.fund.title') }} />
      <Stack.Screen name="fund/receipt/[id]" options={{ title: t('m.fund.receiptTitle') }} />
    </Stack>
  );
}
