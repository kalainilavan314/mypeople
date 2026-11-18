import type { Href } from 'expo-router';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Where each Home feature key leads in this app. A key with no route is a
 * service that is not built yet: its tile says so instead of opening a
 * screen that pretends to work.
 */
export const FEATURE_ROUTES: Partial<Record<string, Href>> = {
  report_issue: '/issues/report',
  my_area: '/issues',
  local_reports: { pathname: '/issues', params: { segment: 'issues' } },
  area_projects: { pathname: '/issues', params: { segment: 'projects' } },
  community: '/hub',
  events: '/events',
  card: '/card',
  gallery: '/gallery',
  profile: '/profile',
  party_fund: '/fund' as unknown as Href,
  volunteer: '/volunteer',
  volunteering: '/volunteer',
  ideas: '/ideas',
  surveys: '/surveys',
  learning: '/learning',
  invite: '/referrals/invite',
  promises: '/promises',
  support: '/support',
};

export const FEATURE_ICONS: Record<string, IconName> = {
  report_issue: 'megaphone-outline',
  volunteer: 'hand-left-outline',
  my_area: 'map-outline',
  community: 'people-outline',
  ideas: 'bulb-outline',
  surveys: 'clipboard-outline',
  learning: 'school-outline',
  party_fund: 'wallet-outline',
  invite: 'person-add-outline',
  volunteering: 'hand-left-outline',
  local_reports: 'document-text-outline',
  area_projects: 'construct-outline',
  events: 'calendar-outline',
  card: 'card-outline',
  gallery: 'images-outline',
  profile: 'person-outline',
  help: 'help-buoy-outline',
  promises: 'flag-outline',
  support: 'heart-outline',
};
