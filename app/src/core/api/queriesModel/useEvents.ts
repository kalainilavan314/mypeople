import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: () => api.getEvents() });
