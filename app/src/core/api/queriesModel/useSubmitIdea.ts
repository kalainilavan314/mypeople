import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSubmitIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bodyTa: string) => api.submitIdea(bodyTa),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ideas }),
  });
}
