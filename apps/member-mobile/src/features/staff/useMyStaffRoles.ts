import type { Assignment } from '@my-people/api-client';
import { areaKeysToName, areaNamesFrom, type AreaNames } from '@my-people/i18n/staff-terms';
import { useApiQuery } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

export type MyStaffRoles = {
  /** The roles that count now; empty for a member without one, and while loading or unreadable. */
  assignments: Assignment[];
  /** Names of the roles' areas; undefined until loaded, when codes show. */
  areaNames: AreaNames | undefined;
};

/**
 * The signed-in person's staff roles, so Home and Profile can show their tier and the way into
 * the Staff section as soon as the team assigns one. Reading one's own roles needs no
 * authenticator code; the section asks for it, and the API checks the role on every staff request.
 */
export function useMyStaffRoles(): MyStaffRoles {
  const access = useApiQuery(() => api().getMyAccess(), []);
  const assignments = access.data ?? [];
  const areaKeys = areaKeysToName(assignments.map((a) => a.area)).join(',');
  const areaNames = useApiQuery(
    async () => (areaKeys ? areaNamesFrom(await api().listAreaNames(areaKeys.split(','))) : new Map()),
    [areaKeys],
  );
  return { assignments, areaNames: areaNames.data };
}
