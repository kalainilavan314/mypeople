import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useConsents = () =>
  useQuery({ queryKey: keys.consents, queryFn: () => api.getConsents() });
