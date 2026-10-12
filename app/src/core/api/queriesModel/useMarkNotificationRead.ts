import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: (list) => qc.setQueryData(keys.notifications, list),
  });
}
