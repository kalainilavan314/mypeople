import { useApiQuery } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * Whether the signed-in person holds a staff role that counts now, so Home and Profile show
 * the way into the Staff section. Reading one's own roles needs no authenticator code; the
 * section asks for it, and the API checks the role on every staff request. While the answer
 * is loading or could not be read, no entry shows.
 */
export function useHasStaffRole(): boolean {
  const access = useApiQuery(() => api().getMyAccess(), []);
  return (access.data?.length ?? 0) > 0;
}
