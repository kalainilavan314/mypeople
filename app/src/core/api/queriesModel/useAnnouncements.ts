import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useAnnouncements = () =>
  useQuery({ queryKey: keys.announcements, queryFn: () => api.getAnnouncements() });
