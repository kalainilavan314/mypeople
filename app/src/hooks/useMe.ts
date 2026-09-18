import { useQuery } from '@tanstack/react-query';
import { authApi, cachedMember, type ServerMember } from '../data/authApi';

/** Query key for the signed-in member, so a mutation can invalidate it. */
export const meKey = ['me'] as const;

/**
 * The signed-in member from the backend, with the locally cached copy shown
 * instantly while the request is in flight.
 *
 * Deliberately a React Query hook rather than useEffect + useState. The
 * previous version fetched on every mount with no shared cache, and useMe is
 * called from fourteen files — App.tsx plus most screens — so a single page
 * load issued two to four identical GET /api/me requests. On a mobile
 * connection to a distant server that is two to four full round trips for one
 * answer. Sharing one cache entry collapses them into one request, and any
 * component mounting later is served from cache.
 *
 * cachedMember() is placeholderData, not initialData: placeholder data does not
 * count as a fetched result, so the request still goes out immediately. As
 * initialData it would be treated as fresh and suppress the refetch for the
 * whole staleTime — meaning a member whose tier or recruit count had changed
 * would keep seeing the stale numbers.
 */
export function useMe(): ServerMember | null {
  const { data } = useQuery<ServerMember | null>({
    queryKey: meKey,
    queryFn: () => authApi.me(),
    placeholderData: () => cachedMember() ?? undefined,
    staleTime: 30_000,
    retry: 1,
  });
  return data ?? null;
}
