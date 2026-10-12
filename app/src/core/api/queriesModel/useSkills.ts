import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useSkills = () => useQuery({ queryKey: keys.skills, queryFn: () => api.getSkills() });
