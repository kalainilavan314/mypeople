import 'server-only';

import { ApiError, type Assignment, type MemberProfile } from '@my-people/api-client';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { readStaffToken, staffApi } from './session';

export type StaffContext = {
  member: MemberProfile;
  assignments: Assignment[];
  permissions: ReadonlySet<string>;
};

/**
 * The signed-in staff member, or a redirect: to sign-in without a working
 * session, to the authenticator step until this session has given the second
 * factor (NFR-SEC-04). Pages use it only to decide what to show; the API
 * refuses every call the person may not make, whatever the page shows. Read
 * once per request, however many components ask.
 */
export const requireStaff = cache(async (): Promise<StaffContext> => {
  if (!(await readStaffToken())) redirect('/sign-in');
  const api = await staffApi();
  let member: MemberProfile;
  let sessionVerified: boolean;
  try {
    member = await api.getMyProfile();
    sessionVerified = (await api.getMfaStatus()).sessionVerified;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/sign-in?ended=1');
    throw error;
  }
  if (!sessionVerified) redirect('/mfa');
  const assignments = await api.getMyAccess();
  return { member, assignments, permissions: new Set(assignments.flatMap((a) => a.permissions)) };
});

/** True when an API refusal means the person lacks the permission or the area. */
export function isRefusal(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
