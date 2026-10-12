import { submitCommunityReport } from '@/core/api/httpContent';
import { keys } from '@/core/api/queriesModel/keys';
import type { NewCommunityReport } from '@/core/api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSubmitCommunityReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCommunityReport) => submitCommunityReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myCommunityReports }),
  });
}
