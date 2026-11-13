import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { IssueCategory, IssueStatus } from '@my-people/api-client';
import type { Tint } from '@my-people/design-tokens/mobile';
import type { Tone } from '@my-people/mobile-ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The colour of each status pill. The pill always carries the status in words too
 * (FR-RPT-003, WCAG 1.4.1); the words are m.issues.status_<status>.
 */
export const STATUS_TONES: Record<IssueStatus, Tone> = {
  received: 'neutral',
  needs_details: 'pending',
  under_review: 'pending',
  in_progress: 'pending',
  resolved: 'verified',
  declined: 'error',
};

/** The icon beside each category; decorative, the category's name is always written next to it. */
export const CATEGORY_ICONS: Record<IssueCategory, IconName> = {
  road: 'car-outline',
  water: 'water-outline',
  waste: 'trash-outline',
  electricity: 'flash-outline',
  agriculture: 'leaf-outline',
  environment: 'earth-outline',
  public_facility: 'business-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

export const CATEGORY_TINTS: Record<IssueCategory, Tint> = {
  road: 'sand',
  water: 'blue',
  waste: 'green',
  electricity: 'amber',
  agriculture: 'green',
  environment: 'teal',
  public_facility: 'purple',
  other: 'brand',
};

/** The member's four-stage stepper (BRD §10.2(b); OD-13: the same four on H06 and H09). */
export const MEMBER_STAGES = [1, 2, 3, 4] as const;

/** The limits the API enforces (IssueReportIn, AdditionIn, ClosureResponseIn), checked here first. */
export const LIMITS = {
  titleMin: 5,
  titleMax: 120,
  descriptionMax: 4000,
  placeMin: 3,
  placeMax: 200,
  informationMin: 5,
  informationMax: 2000,
  informationPhotos: 2,
  noteMin: 5,
  noteMax: 1000,
} as const;
