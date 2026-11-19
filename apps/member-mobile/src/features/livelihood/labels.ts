import type { GuideCategory, GuideReportReason } from '@my-people/api-client';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** M39's categories, in the order FR-LIV-001 lists them; the words are m.livelihood.category_<key>. */
export const GUIDE_CATEGORIES: readonly GuideCategory[] = [
  'assistance_programme',
  'scholarship',
  'job',
  'vocational_training',
  'agriculture',
  'fisheries',
  'enterprise_grant',
  'course',
  'public_service_contact',
];

/** One icon per category, from the app's icon set (one meaning per icon). */
export const CATEGORY_ICONS: Record<GuideCategory, IconName> = {
  assistance_programme: 'gift-outline',
  scholarship: 'ribbon-outline',
  job: 'briefcase-outline',
  vocational_training: 'hammer-outline',
  agriculture: 'leaf-outline',
  fisheries: 'fish-outline',
  enterprise_grant: 'storefront-outline',
  course: 'book-outline',
  public_service_contact: 'call-outline',
};

export const REPORT_REASONS: readonly GuideReportReason[] = ['outdated', 'closed', 'broken_link', 'wrong_details', 'other'];

export const REPORT_NOTE_MAX = 500;

export function isGuideCategory(value: string | undefined): value is GuideCategory {
  return (GUIDE_CATEGORIES as readonly string[]).includes(value ?? '');
}
