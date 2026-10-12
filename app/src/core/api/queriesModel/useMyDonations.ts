import { getMyDonations } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useMyDonations = () =>
  useQuery({ queryKey: keys.myDonations, queryFn: getMyDonations });
