import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useAnnouncement = (id: string) =>
  useQuery({
    queryKey: keys.announcement(id),
    queryFn: () => api.getAnnouncement(id),
    enabled: !!id,
  });
