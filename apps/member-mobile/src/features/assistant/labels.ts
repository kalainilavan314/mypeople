import type { AssistantHandoverState, AssistantMessage } from '@my-people/api-client';

import type { Tone } from '@my-people/mobile-ui';

/** The API's limits (services/api/app/modules/ai/assistant/rules.py and schemas.py). */
export const QUESTION_MAX = 1000;
export const NOTE_MIN = 5;
export const NOTE_MAX = 2000;

export const HANDOVER_TONES: Readonly<Record<AssistantHandoverState, Tone>> = {
  open: 'pending',
  answered: 'verified',
  closed: 'neutral',
};

/** A question with the answer that followed it; the newest exchange is shown first. */
export type Exchange = { question: AssistantMessage; answer: AssistantMessage | null };

export function exchanges(messages: readonly AssistantMessage[]): Exchange[] {
  const paired: Exchange[] = [];
  for (const message of messages) {
    if (message.role === 'member') paired.push({ question: message, answer: null });
    else if (paired.length > 0 && paired[paired.length - 1].answer === null) paired[paired.length - 1].answer = message;
  }
  return paired.reverse();
}
