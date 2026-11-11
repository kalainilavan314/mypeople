import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { tabIcon, tabOptions } from '@my-people/mobile-ui';

// The member app's five permanent tabs (BRD §15A.4). New features open from
// Home, Events, Card and Profile; the tab bar itself does not grow.
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <Tabs
      screenOptions={tabOptions(language)}>
      {/* Home has its own greeting header. */}
      <Tabs.Screen name="index" options={{ title: t('nav.home'), headerShown: false, tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="events" options={{ title: t('nav.events'), tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="card" options={{ title: t('nav.card'), tabBarIcon: tabIcon('card') }} />
      <Tabs.Screen name="gallery" options={{ title: t('nav.gallery'), tabBarIcon: tabIcon('images') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}
