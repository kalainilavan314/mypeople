import { state } from '@/core/api/prototype/clientModel/state';
export function applyRsvpCounts(): void {
  state.events = state.events.map((e) => ({ ...e }));
}
