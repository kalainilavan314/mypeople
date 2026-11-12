import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { tabIcon, tabOptions } from '@my-people/mobile-ui';

import { LeaveStaffButton } from '@/features/staff/LeaveStaffButton';

// The Staff section's tabs (BRD §11.30): S02 tasks, S08 check-in, S13 approvals,
// S14 alerts and S01 the role context. The owner chose one app for members and
// staff on 12 November 2026 (OD-26), so these open from the member app, and the
// header's back button returns to it.
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <Tabs
      screenOptions={{ ...tabOptions(language), headerLeft: () => <LeaveStaffButton /> }}>
      <Tabs.Screen name="index" options={{ title: t('s.tabs.home'), tabBarIcon: tabIcon('checkbox-outline') }} />
      <Tabs.Screen name="check-in" options={{ title: t('s.tabs.checkIn'), tabBarIcon: tabIcon('qr-code-outline') }} />
      <Tabs.Screen name="approvals" options={{ title: t('s.tabs.approvals'), tabBarIcon: tabIcon('git-pull-request-outline') }} />
      <Tabs.Screen name="alerts" options={{ title: t('s.tabs.alerts'), tabBarIcon: tabIcon('notifications-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t('s.tabs.profile'), tabBarIcon: tabIcon('id-card-outline') }} />
    </Tabs>
  );
}
