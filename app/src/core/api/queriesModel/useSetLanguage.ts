import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import type { Lang } from '@/core/api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSetLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lang: Lang) => api.setLanguage(lang),
    onSuccess: (member) => qc.setQueryData(keys.member, member),
  });
}
