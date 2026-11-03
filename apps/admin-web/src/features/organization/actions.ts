'use server';

import type { AssignmentInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;

function refused(error: unknown): never {
  const { code, problems } = failure(error);
  redirect(`/access?error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

/** Previews an assignment and creates a durable, database-backed 10-minute preview record. */
export async function previewAssignment(formData: FormData): Promise<void> {
  await requireStaff();
  const code = String(formData.get('code') ?? '').trim();
  const level = String(formData.get('level') ?? 'district') as AssignmentInput['area']['level'];
  const areaCode = String(formData.get('areaCode') ?? '').trim();
  const tier = String(formData.get('tier') ?? '') as AssignmentInput['tier'];
  const permissions = formData.getAll('permissions').map(String);
  const note = String(formData.get('note') ?? '').trim();

  if (!code) {
    redirect('/access?error=assignment_refused&problems=code_required');
  }

  let preview;
  try {
    const api = await staffApi();
    preview = await api.createAssignmentPreview({
      memberCode: code,
      tier,
      area: { level, code: level === 'platform' ? null : areaCode },
      permissions,
      note: note || null,
    });
  } catch (error) {
    refused(error);
  }

  // Zero PII, member codes, permissions or notes in the URL. Only the opaque preview ID travels in the address.
  redirect(`/access?previewId=${encodeURIComponent(preview.id)}`);
}

/** Atomically confirms the preview in a single database transaction with row-locking and revalidation. */
export async function createAssignment(formData: FormData): Promise<void> {
  await requireStaff();
  const confirmed = formData.get('confirmAssignment') === '1';
  if (!confirmed) {
    redirect('/access?error=confirmation_required');
  }

  const previewId = String(formData.get('previewId') ?? '').trim();
  if (!UUID.test(previewId)) {
    redirect('/access?error=preview_expired_or_invalid');
  }

  try {
    const api = await staffApi();
    await api.confirmAssignmentPreview(previewId);
  } catch (error) {
    const { code } = failure(error);
    if (code === 'preview_expired_or_invalid' || code === 'not_found') {
      redirect('/access?error=preview_expired_or_invalid');
    }
    refused(error);
  }

  redirect('/access?done=assigned');
}

/** Safely cancels an active preview in the database and returns to the access overview. */
export async function cancelAssignmentPreview(formData: FormData): Promise<void> {
  await requireStaff();
  const previewId = String(formData.get('previewId') ?? '').trim();
  if (UUID.test(previewId)) {
    try {
      const api = await staffApi();
      await api.cancelAssignmentPreview(previewId);
    } catch {
      // Safe no-op on missing/expired preview cancellation
    }
  }
  redirect('/access?done=preview_cleared');
}

/** Ends an assignment with a mandatory confirmed reason; rights cease immediately on next token check. */
export async function revokeAssignment(formData: FormData): Promise<void> {
  const confirmed = formData.get('confirmRevoke') === '1';
  if (!confirmed) {
    redirect('/access?error=confirmation_required');
  }

  const id = String(formData.get('assignmentId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(id)) redirect('/access');
  if (reason.length < 3) {
    redirect('/access?error=assignment_refused&problems=reason_required');
  }

  try {
    await (await staffApi()).revokeAssignment(id, reason);
  } catch (error) {
    refused(error);
  }
  redirect('/access?done=revoked');
}
