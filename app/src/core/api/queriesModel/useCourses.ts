import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useCourses = () =>
  useQuery({ queryKey: keys.courses, queryFn: () => api.getCourses() });
