import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useBadges = () => useQuery({ queryKey: keys.badges, queryFn: () => api.getBadges() });
