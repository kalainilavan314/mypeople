import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@my-people/design-tokens';
import { fontFamilyFor, tabIcon } from '@my-people/mobile-ui';

// The staff app's tabs (BRD §11.30, screens S01-S18). It is a separate app
// from the member app, as BRD §15A.5 recommends; OD-26 confirms that choice.
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
      }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="tasks" options={{ title: t('staff:tabs.tasks'), tabBarIcon: tabIcon('checkbox-outline') }} />
      <Tabs.Screen name="cases" options={{ title: t('staff:tabs.cases'), tabBarIcon: tabIcon('folder-open-outline') }} />
      <Tabs.Screen name="check-in" options={{ title: t('staff:tabs.checkIn'), tabBarIcon: tabIcon('qr-code-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: tabIcon('person-outline') }} />
    </Tabs>
  );
}
