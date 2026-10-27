import type { Assignment, MfaStatus } from '@my-people/api-client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

type Staff = {
  assignments: Assignment[];
  /** Every permission held in any assignment; the API still checks each request and its area. */
  permissions: ReadonlySet<string>;
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
  const value = useMemo(
    () => ({ assignments, mfa, reload, permissions: new Set(assignments.flatMap((a) => a.permissions)) }),
    [assignments, mfa, reload],
  );
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

/** The signed-in staff member's roles; only inside the (staff) gate. */
export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error('useStaff needs StaffProvider');
  return staff;
}
