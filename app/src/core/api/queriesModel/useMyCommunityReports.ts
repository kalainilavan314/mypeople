import { getMyCommunityReports } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useMyCommunityReports = () =>
  useQuery({ queryKey: keys.myCommunityReports, queryFn: getMyCommunityReports });
