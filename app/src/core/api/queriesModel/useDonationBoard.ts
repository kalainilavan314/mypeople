import { getDonationBoard } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useDonationBoard = () =>
  useQuery({ queryKey: keys.donationBoard, queryFn: getDonationBoard });
