import type { AssistedChecklistItem, AssistedState } from '@my-people/api-client';

import type { Tone } from '@my-people/mobile-ui';

/** A request's state in words and colour (never colour alone). */
export const STATE_TONE: Record<AssistedState, Tone> = {
  requested: 'pending',
  scheduled: 'pending',
  in_session: 'pending',
  completed: 'verified',
  cancelled: 'neutral',
  closed: 'neutral',
};

/** FR-STF-004: the witness checklist, in the API's order. */
export const CHECKLIST: AssistedChecklistItem[] = [
  'member_present',
  'original_document_seen',
  'face_matches_document',
  'captured_on_allowed_device',
  'no_copies_kept',
  'declaration_by_member',
];
