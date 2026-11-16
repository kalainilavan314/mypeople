import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, comfortableTypeScale } from '@my-people/design-tokens';
import { fontFamilyFor, tabIcon } from '@my-people/mobile-ui';

import { MemberTopBar } from '@/components/MemberTopBar';

// Four frequent destinations stay in thumb reach. Account and notifications
// live in the stable top bar instead of competing with primary navigation.
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 70 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 7),
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: { minHeight: 56 },
        tabBarLabelStyle: {
          fontFamily: fontFamilyFor(language, 600),
          fontSize: comfortableTypeScale.nav.size,
          lineHeight: comfortableTypeScale.nav.lineHeight,
        },
        tabBarHideOnKeyboard: true,
        header: () => <MemberTopBar />,
        sceneStyle: { backgroundColor: colors.page },
      }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home-outline', 28) }} />
      <Tabs.Screen name="events" options={{ title: t('nav.events'), tabBarIcon: tabIcon('calendar-outline', 28) }} />
      <Tabs.Screen name="card" options={{ title: t('nav.card'), tabBarIcon: tabIcon('card-outline', 28) }} />
      <Tabs.Screen name="gallery" options={{ title: t('nav.gallery'), tabBarIcon: tabIcon('images-outline', 28) }} />
    </Tabs>
  );
}
