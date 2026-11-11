import type { Assignment, MfaStatus } from '@my-people/api-client';
import { areaKeysToName, areaNamesFrom, type AreaNames } from '@my-people/i18n/staff-terms';
import { useApiQuery } from '@my-people/mobile-ui';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { api } from '@/lib/api';

type Staff = {
  assignments: Assignment[];
  /** Every permission held in any assignment; the API still checks each request and its area. */
  permissions: ReadonlySet<string>;
  /** Names of the assignments' areas; undefined until loaded (or if they cannot be), when codes show. */
  areaNames: AreaNames | undefined;
  mfa: MfaStatus;
  reload: () => void;
};

const StaffContext = createContext<Staff | null>(null);

export function StaffProvider({
  assignments,
  mfa,
  reload,
  children,
}: {
  assignments: Assignment[];
  mfa: MfaStatus;
  reload: () => void;
  children: ReactNode;
}) {
  const areaKeys = areaKeysToName(assignments.map((a) => a.area)).join(',');
  const areaNames = useApiQuery(
    async () => (areaKeys ? areaNamesFrom(await api().listAreaNames(areaKeys.split(','))) : new Map()),
    [areaKeys],
  );
  const value = useMemo(
    () => ({
      assignments,
      mfa,
      reload,
      areaNames: areaNames.data,
      permissions: new Set(assignments.flatMap((a) => a.permissions)),
    }),
    [assignments, mfa, reload, areaNames.data],
  );
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

/** The signed-in staff member's roles; only inside the (staff) gate. */
export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error('useStaff needs StaffProvider');
  return staff;
}
