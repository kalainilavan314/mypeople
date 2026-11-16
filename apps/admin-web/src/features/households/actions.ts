'use server';

import { redirect } from 'next/navigation';

/**
 * Opens the household record for a member ID. The record page asks the API once, so each opening
 * is recorded once (in the household's history and the audit log); refusals are shown there.
 */
export async function findHouseholdMember(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!code) {
    redirect('/members?error=required');
  }
  redirect(`/members/${encodeURIComponent(code)}`);
}
