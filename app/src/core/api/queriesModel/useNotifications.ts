import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: () => api.getNotifications() });
