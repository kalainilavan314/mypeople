import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useBackIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.backIdea(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ideas }),
  });
}
