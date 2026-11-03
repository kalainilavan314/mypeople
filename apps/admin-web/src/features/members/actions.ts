'use server';

import type { MembershipChangeInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

/** Finds a member by exact member ID and opens their membership file. */
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

/** Activate, suspend, reinstate or inactivate, always with a confirmed reason. */
export async function changeMembership(formData: FormData): Promise<void> {
  const memberId = String(formData.get('memberId') ?? '');
  if (!UUID.test(memberId)) redirect('/membership');

  const [action, reasonCode] = String(formData.get('change') ?? '').split(':') as [MembershipChangeInput['action'], string];
  const note = String(formData.get('note') ?? '').trim();
  const confirmed = formData.get('confirmChange') === '1';

  if (!confirmed) {
    redirect(`/membership/${memberId}?error=confirmation_required`);
  }

  try {
    await (await staffApi()).changeMembership(memberId, { action, reasonCode, note: note || null });
  } catch (error) {
    const { code, problems } = failure(error);
    redirect(`/membership/${memberId}?error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
  }
  redirect(`/membership/${memberId}?done=${action}`);
}
