import { confirmCardDonation } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useConfirmCardDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmCardDonation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.donationBoard });
      qc.invalidateQueries({ queryKey: keys.myDonations });
    },
  });
}
