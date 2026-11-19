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
  const permissions = new Set(assignments.flatMap((a) => a.permissions));
  // D27: an account a hospital or the blood transfusion service was authorised for holds PRM-55 without a
  // staff tier. Only for showing the desk; the API checks the authorisation on every call.
  if (await isBloodRequester(api)) permissions.add('donor.request');
  return { member, assignments, permissions };
});

/** False when the module is switched off or the account is not a partner requester. */
async function isBloodRequester(api: Awaited<ReturnType<typeof staffApi>>): Promise<boolean> {
  try {
    return Boolean((await api.getBloodDeskAccess()).partner);
  } catch {
    return false;
  }
}

/** True when an API refusal means the person lacks the permission or the area. */
export function isRefusal(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
