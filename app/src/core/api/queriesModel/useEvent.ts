import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useEvent = (id: string) =>
  useQuery({ queryKey: keys.event(id), queryFn: () => api.getEvent(id), enabled: !!id });
