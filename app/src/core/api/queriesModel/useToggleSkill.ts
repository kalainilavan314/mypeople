import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useToggleSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleSkill(id),
    onSuccess: (skills) => qc.setQueryData(keys.skills, skills),
  });
}
