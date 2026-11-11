import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { tabIcon, tabOptions } from '@my-people/mobile-ui';

// The staff app's tabs (BRD §11.30): S02 tasks, S08 check-in, S13 approvals,
// S14 alerts and S01 the role context. It is a separate app from the member
// app, as BRD §15A.5 recommends (OD-26).
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <Tabs
      screenOptions={tabOptions(language)}>
      <Tabs.Screen name="index" options={{ title: t('s.tabs.home'), tabBarIcon: tabIcon('checkbox') }} />
      <Tabs.Screen name="check-in" options={{ title: t('s.tabs.checkIn'), tabBarIcon: tabIcon('qr-code') }} />
      <Tabs.Screen name="approvals" options={{ title: t('s.tabs.approvals'), tabBarIcon: tabIcon('git-pull-request') }} />
      <Tabs.Screen name="alerts" options={{ title: t('s.tabs.alerts'), tabBarIcon: tabIcon('notifications') }} />
      <Tabs.Screen name="profile" options={{ title: t('s.tabs.profile'), tabBarIcon: tabIcon('id-card') }} />
    </Tabs>
  );
}
