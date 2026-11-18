import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { control } from '@my-people/design-tokens/mobile';
import { tabIcon, tabOptions } from '@my-people/mobile-ui';

import { MemberTopBar } from '@/components/MemberTopBar';

// Exactly four destinations in thumb reach: Home, Events, Card, Gallery. Profile and notifications
// live in the top bar instead of competing with primary navigation.
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const base = tabOptions(i18n.language);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        ...base,
        tabBarStyle: {
          ...base.tabBarStyle,
          height: control.tabBar + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        header: () => <MemberTopBar />,
      }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="events" options={{ title: t('nav.events'), tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="card" options={{ title: t('nav.card'), tabBarIcon: tabIcon('card-outline') }} />
      <Tabs.Screen name="gallery" options={{ title: t('nav.gallery'), tabBarIcon: tabIcon('images-outline') }} />
    </Tabs>
  );
}
