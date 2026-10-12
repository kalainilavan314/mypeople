import { reviewDonation } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useReviewDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: 'approve' | 'reject';
      note?: string;
    }) => reviewDonation(id, action, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.pendingDonations });
      qc.invalidateQueries({ queryKey: keys.donationBoard });
      qc.invalidateQueries({ queryKey: keys.myDonations });
    },
  });
}
