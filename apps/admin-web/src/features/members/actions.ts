'use server';

import type { MembershipChangeInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

/** Finds a member by exact member ID (FR-STF-003) and opens their membership file. */
export async function findMember(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim();
  let memberId: string;
  try {
    memberId = (await (await staffApi()).lookupMember(code)).memberId;
  } catch (error) {
    redirect(`/membership?error=${failure(error).code}`);
  }
  redirect(`/membership/${memberId}`);
}

/** D06: activate, suspend, reinstate or inactivate, always with a reason (BR-015). */
export async function changeMembership(formData: FormData): Promise<void> {
  const memberId = String(formData.get('memberId') ?? '');
  if (!UUID.test(memberId)) redirect('/membership');
  const [action, reasonCode] = String(formData.get('change') ?? '').split(':') as [MembershipChangeInput['action'], string];
  const note = String(formData.get('note') ?? '').trim();
  try {
    await (await staffApi()).changeMembership(memberId, { action, reasonCode, note: note || null });
  } catch (error) {
    const { code, problems } = failure(error);
    redirect(`/membership/${memberId}?error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
  }
  redirect(`/membership/${memberId}?done=${action}`);
}
