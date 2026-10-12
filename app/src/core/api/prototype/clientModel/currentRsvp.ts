import { state } from '@/core/api/prototype/clientModel/state';
import type { RsvpStatus } from '@/core/api/types';
export function currentRsvp(eventId: string): RsvpStatus | null {
  return state.rsvps[eventId] ?? null;
}
