import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import type { RsvpStatus } from '@/core/api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSetRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: RsvpStatus | null }) =>
      api.setRsvp(eventId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.events });
    },
  });
}
