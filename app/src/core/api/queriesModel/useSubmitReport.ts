import { api } from '@/core/api';
import type { NewReportInput } from '@/core/api/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReportInput) => api.submitReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reports }),
  });
}
