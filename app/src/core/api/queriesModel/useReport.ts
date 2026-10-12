import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useReport = (id: string) =>
  useQuery({ queryKey: keys.report(id), queryFn: () => api.getReport(id), enabled: !!id });
