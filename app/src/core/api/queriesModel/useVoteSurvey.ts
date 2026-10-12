import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useVoteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, optionId }: { questionId: string; optionId: string }) =>
      api.voteSurvey(questionId, optionId),
    onSuccess: (survey) => qc.setQueryData(keys.survey, survey),
  });
}
