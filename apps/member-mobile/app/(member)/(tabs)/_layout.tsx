import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@my-people/design-tokens';
import { fontFamilyFor, tabIcon } from '@my-people/mobile-ui';

// The member app's five permanent tabs (BRD §15A.4). New features open from
// Home, Events, Card and Profile; the tab bar itself does not grow.
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamilyFor(language, 600) },
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: fontFamilyFor(language, 700), color: colors.text },
        sceneStyle: { backgroundColor: colors.page },
      }}>
      {/* Home has its own greeting header. */}
      <Tabs.Screen name="index" options={{ title: t('nav.home'), headerShown: false, tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="events" options={{ title: t('nav.events'), tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="card" options={{ title: t('nav.card'), tabBarIcon: tabIcon('card-outline') }} />
      <Tabs.Screen name="gallery" options={{ title: t('nav.gallery'), tabBarIcon: tabIcon('images-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: tabIcon('person-outline') }} />
    </Tabs>
  );
}
