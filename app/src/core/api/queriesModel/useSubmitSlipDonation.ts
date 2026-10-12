import { submitSlipDonation } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSubmitSlipDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitSlipDonation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.myDonations });
    },
  });
}
