import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { comfortableTypeScale } from '@my-people/design-tokens/mobile';
import { tabIcon, tabOptions } from '@my-people/mobile-ui';

import { MemberTopBar } from '@/components/MemberTopBar';

// Four frequent destinations stay in thumb reach. Account and notifications
// live in the stable top bar instead of competing with primary navigation.
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const insets = useSafeAreaInsets();
  const base = tabOptions(language);

  return (
    <Tabs
      screenOptions={{
        ...base,
        tabBarStyle: {
          ...base.tabBarStyle,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarItemStyle: { minHeight: 56, gap: 4 },
        tabBarLabelStyle: {
          ...base.tabBarLabelStyle,
          // Tamil labels are longer; one step smaller keeps "நிகழ்வுகள்" whole in an 80 px tab at 320 px.
          fontSize: language === 'ta' ? comfortableTypeScale.nav.size - 1.5 : comfortableTypeScale.nav.size,
          lineHeight: comfortableTypeScale.nav.lineHeight,
        },
        header: () => <MemberTopBar />,
      }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="events" options={{ title: t('nav.events'), tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="card" options={{ title: t('nav.card'), tabBarIcon: tabIcon('id-card-outline') }} />
      <Tabs.Screen name="gallery" options={{ title: t('nav.gallery'), tabBarIcon: tabIcon('images-outline') }} />
    </Tabs>
  );
}
