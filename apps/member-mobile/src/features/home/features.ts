import type { Href } from 'expo-router';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Tint } from '@my-people/design-tokens/mobile';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Where each Home feature key leads in this app. A key with no route is a
 * service that is not built yet: its tile says so instead of opening a
 * screen that pretends to work.
 */
export const FEATURE_ROUTES: Partial<Record<string, Href>> = {
  my_area: '/profile/area',
  community: '/hub',
  events: '/events',
  card: '/card',
  gallery: '/gallery',
  profile: '/profile',
  party_fund: '/fund' as unknown as Href,
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
};

/** The tile colour of each feature, as in the reference recording. */
export const FEATURE_TINTS: Partial<Record<string, Tint>> = {
  my_area: 'green',
  community: 'sand',
  events: 'teal',
  help: 'purple',
  report_issue: 'blue',
  volunteer: 'rose',
  volunteering: 'rose',
  ideas: 'amber',
  surveys: 'purple',
  learning: 'green',
  party_fund: 'blue',
  invite: 'green',
  local_reports: 'blue',
  area_projects: 'teal',
  card: 'navy',
  gallery: 'blue',
  profile: 'navy',
};
