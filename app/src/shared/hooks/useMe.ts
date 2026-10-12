import { authApi, cachedMember, type ServerMember } from '@/core/api/authApi';
import { useQuery } from '@tanstack/react-query';

export const meKey = ['me'] as const;

export function useMeQuery() {
  return useQuery<ServerMember | null>({
    queryKey: meKey,
    queryFn: () => authApi.me(),
    placeholderData: () => cachedMember() ?? undefined,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useMe(): ServerMember | null {
  const { data } = useMeQuery();
  return data ?? null;
}
