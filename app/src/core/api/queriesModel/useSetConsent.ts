import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import type { ConsentKind } from '@/core/api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useSetConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, value }: { kind: ConsentKind; value: boolean }) =>
      api.setConsent(kind, value),
    onSuccess: (consents) => qc.setQueryData(keys.consents, consents),
  });
}
