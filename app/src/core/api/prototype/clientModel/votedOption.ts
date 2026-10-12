import { state } from '@/core/api/prototype/clientModel/state';
export function votedOption(questionId: string): string | undefined {
  return state.votes[questionId];
}
