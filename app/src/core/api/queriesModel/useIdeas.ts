import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useIdeas = () => useQuery({ queryKey: keys.ideas, queryFn: () => api.getIdeas() });
