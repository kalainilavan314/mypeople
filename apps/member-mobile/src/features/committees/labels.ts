import type Ionicons from '@expo/vector-icons/Ionicons';
import type {
  CommitteeItem,
  CommitteeMembershipState,
  CommitteeRole,
  CommitteeWingType,
} from '@my-people/api-client';
import type { ComponentProps } from 'react';

import type { Tone } from '@my-people/mobile-ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const WING_TYPES: readonly CommitteeWingType[] = ['youth', 'women', 'farmers', 'fishers', 'professional', 'diaspora'];
export const ROLES: readonly CommitteeRole[] = ['coordinator', 'secretary', 'member'];

/** One meaning per icon: people for a committee, globe only for the diaspora wing. */
export function wingIcon(wing: CommitteeWingType): IconName {
  return wing === 'diaspora' ? 'globe-outline' : 'people-outline';
}

/** The colour of each membership state's pill; its words (m.committees.state_*) always go with it. */
export const STATE_TONES: Record<CommitteeMembershipState, Tone> = {
  applied: 'pending',
  approved: 'verified',
  declined: 'error',
  withdrawn: 'neutral',
  left: 'neutral',
  removed: 'error',
};

export const THREAD_TITLE_MIN = 3;
export const THREAD_BODY_MIN = 2;
export const REPLY_MIN = 2;

/** Meetings first by time; minutes are shown under their meeting. */
export function meetingsWithMinutes(items: CommitteeItem[]) {
  const minutes = items.filter((item) => item.itemType === 'minutes');
  return items
    .filter((item) => item.itemType === 'meeting')
    .sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))
    .map((meeting) => ({ meeting, minutes: minutes.filter((m) => m.meetingId === meeting.id) }));
}

/** A date-only value ("2026-11-20") as an ISO moment at noon UTC, so it formats as the same calendar day. */
export function dateOnly(value: string): string {
  return `${value}T12:00:00Z`;
}

/** The phone's own wall-clock time for a moment, for supporters abroad (FR-DSP-002). */
export function deviceTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language === 'ta' ? 'ta' : 'en', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
