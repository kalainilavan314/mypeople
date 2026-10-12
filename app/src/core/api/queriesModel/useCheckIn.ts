import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.checkIn(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.member });
      qc.invalidateQueries({ queryKey: keys.events });
    },
  });
}
