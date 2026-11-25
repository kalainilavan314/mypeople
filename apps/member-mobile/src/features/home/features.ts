import type { Href } from 'expo-router';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ImageSourcePropType } from 'react-native';

import type { Tint } from '@my-people/design-tokens/mobile';

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
  budgeting: '/budgeting',
  committees: '/committees',
  diaspora: '/diaspora',
  disaster_alerts: '/alerts',
  blood_donors: '/blood-donors',
  livelihood_guide: '/livelihood',
  representatives: '/representatives',
  renewal: '/renewal',
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
  card: 'id-card-outline',
  gallery: 'images-outline',
  profile: 'person-outline',
  help: 'help-buoy-outline',
  promises: 'flag-outline',
  support: 'heart-outline',
  budgeting: 'wallet-outline',
  committees: 'people-outline',
  diaspora: 'globe-outline',
  disaster_alerts: 'warning-outline',
  blood_donors: 'water-outline',
  livelihood_guide: 'briefcase-outline',
  representatives: 'chatbubbles-outline',
  renewal: 'refresh-circle-outline',
};

/**
 * The photo on each service button (owner's pictures, 25 November 2026). A key with no photo
 * (Ideas, for now) shows its icon on a plain tile.
 */
export const FEATURE_PHOTOS: Partial<Record<string, ImageSourcePropType>> = {
  report_issue: require('../../../assets/features/report-issue.webp'),
  volunteer: require('../../../assets/features/volunteer.webp'),
  my_area: require('../../../assets/features/my-area.webp'),
  community: require('../../../assets/features/community.webp'),
  surveys: require('../../../assets/features/surveys.webp'),
  learning: require('../../../assets/features/learning.webp'),
  party_fund: require('../../../assets/features/party-fund.webp'),
  invite: require('../../../assets/features/invite.webp'),
  volunteering: require('../../../assets/features/volunteering.webp'),
  local_reports: require('../../../assets/features/local-reports.webp'),
  area_projects: require('../../../assets/features/area-projects.webp'),
  promises: require('../../../assets/features/promises.webp'),
  support: require('../../../assets/features/support.webp'),
  budgeting: require('../../../assets/features/budgeting.webp'),
  committees: require('../../../assets/features/committees.webp'),
  diaspora: require('../../../assets/features/diaspora.webp'),
  disaster_alerts: require('../../../assets/features/disaster-alerts.webp'),
  blood_donors: require('../../../assets/features/blood-donors.webp'),
  livelihood_guide: require('../../../assets/features/livelihood-guide.webp'),
  representatives: require('../../../assets/features/representatives.webp'),
  renewal: require('../../../assets/features/renewal.webp'),
};

/** The tile of each feature; in the sage design (18 November 2026) every tile is the same calm sage. */
export const FEATURE_TINTS: Partial<Record<string, Tint>> = {
  my_area: 'green',
  community: 'sand',
  events: 'teal',
  help: 'purple',
  report_issue: 'blue',
  volunteer: 'brand',
  volunteering: 'brand',
  ideas: 'brand',
  surveys: 'purple',
  learning: 'green',
  party_fund: 'blue',
  invite: 'green',
  local_reports: 'blue',
  area_projects: 'teal',
  card: 'brand',
  gallery: 'blue',
  profile: 'brand',
  promises: 'teal',
  support: 'brand',
  budgeting: 'brand',
  committees: 'teal',
  diaspora: 'green',
  disaster_alerts: 'amber',
  blood_donors: 'brand',
  livelihood_guide: 'green',
  representatives: 'teal',
  renewal: 'green',
};
