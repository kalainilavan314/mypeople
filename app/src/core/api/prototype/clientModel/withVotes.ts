import { clone } from '@/core/api/prototype/clientModel/clone';
import type { Survey } from '@/core/api/types';
export function withVotes(survey: Survey): Survey {
  return clone(survey);
}
