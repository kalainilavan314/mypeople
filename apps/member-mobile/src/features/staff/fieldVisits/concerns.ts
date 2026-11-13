import type { FieldVisitConcern } from '@my-people/api-client';

/** PRM-51: the permission to record field visits. */
export const FIELD_COLLECT = 'field.collect';

/** The concerns a visit can note (FR-FLD-002); words are s.fieldVisits.concern_<key>. */
export const CONCERNS: readonly FieldVisitConcern[] = [
  'water',
  'roads',
  'health',
  'education',
  'livelihood',
  'housing',
  'electricity',
  'waste',
  'safety',
  'elderly_care',
  'disability',
  'other',
];

/** The API's limits (FieldVisitIn). */
export const LIMITS = { notesMax: 1000, placeMax: 200, followUpMax: 500 } as const;

/** "CI-00042": a community issue's case number. */
export const CASE_NUMBER = /^CI-[0-9]{5,}$/;
