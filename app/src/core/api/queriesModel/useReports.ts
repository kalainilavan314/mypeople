import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useReports = () =>
  useQuery({ queryKey: keys.reports, queryFn: () => api.getReports() });
