'use server';

import type { AssignmentInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function refused(error: unknown, extra = ''): never {
  const { code, problems } = failure(error);
  redirect(`/access?error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}${extra}`);
}

/** The form's assignment, with the person found by exact member ID (FR-WEB-030). */
async function assignmentFrom(formData: FormData): Promise<AssignmentInput> {
  const code = String(formData.get('code') ?? '').trim();
  const level = String(formData.get('level') ?? 'district') as AssignmentInput['area']['level'];
  const areaCode = String(formData.get('areaCode') ?? '').trim();
  const person = await (await staffApi()).lookupMember(code);
  return {
    memberId: person.memberId,
    tier: String(formData.get('tier')) as AssignmentInput['tier'],
    area: { level, code: level === 'platform' ? null : areaCode },
    permissions: formData.getAll('permissions').map(String),
    note: String(formData.get('note') ?? '').trim() || null,
  };
}

/** FR-WEB-031: check before saving; nothing is stored. */
export async function previewAssignment(formData: FormData): Promise<void> {
  let result;
  try {
    result = await (await staffApi()).previewAssignment(await assignmentFrom(formData));
  } catch (error) {
    refused(error);
  }
  if (!result.allowed) redirect(`/access?error=assignment_refused&problems=${encodeURIComponent(result.problems.join(','))}`);
  redirect('/access?done=preview_allowed');
}

/** RB-02, RB-03: assign within the administrator's own area, below their own tier; recorded with who granted it. */
export async function createAssignment(formData: FormData): Promise<void> {
  try {
    await (await staffApi()).createAssignment(await assignmentFrom(formData));
  } catch (error) {
    refused(error);
  }
  redirect('/access?done=assigned');
}

/** Ends an assignment with a reason; the person loses its rights on their next request. */
export async function revokeAssignment(formData: FormData): Promise<void> {
  const id = String(formData.get('assignmentId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(id)) redirect('/access');
  try {
    await (await staffApi()).revokeAssignment(id, reason);
  } catch (error) {
    refused(error);
  }
  redirect('/access?done=revoked');
}
