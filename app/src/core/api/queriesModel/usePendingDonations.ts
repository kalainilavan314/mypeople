import { getPendingDonations } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const usePendingDonations = (enabled: boolean) =>
  useQuery({ queryKey: keys.pendingDonations, queryFn: getPendingDonations, enabled });
