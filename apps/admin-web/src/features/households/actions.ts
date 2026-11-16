'use server';

import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

/** Finds a member by exact member ID and opens their household operational view. */
export async function findHouseholdMember(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    redirect('/members?error=required');
  }

  try {
    const api = await staffApi();
    const result = await api.staffViewHousehold(code);
    redirect(`/members/${result.targetMemberId}`);
  } catch (error) {
    const fail = failure(error);
    redirect(`/members?error=${encodeURIComponent(fail.code)}`);
  }
}
