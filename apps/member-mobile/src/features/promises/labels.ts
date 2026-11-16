import type { PromiseStatus, PromiseTheme } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

/** The status pill's colour; the words (m.promises.status_<status>) always go with it (FR-PRM-006). */
export const STATUS_TONES: Record<PromiseStatus, Tone> = {
  not_started: 'neutral',
  in_progress: 'pending',
  completed: 'verified',
  delayed: 'error',
  blocked: 'error',
  withdrawn: 'neutral',
};

export const PROMISE_STATUSES: readonly PromiseStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'delayed',
  'blocked',
  'withdrawn',
];

export const PROMISE_THEMES: readonly PromiseTheme[] = [
  'roads_transport',
  'drinking_water',
  'health',
  'education',
  'employment',
  'agriculture',
  'fisheries',
  'housing',
  'environment',
  'governance',
  'other',
];

/** The API's limits on feedback (PromiseFeedbackIn). */
export const FEEDBACK_MIN = 5;
export const FEEDBACK_MAX = 1000;
