'use server';

import type { PhaseGate } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

function back(query: string): never {
  redirect(`/settings?${query}`);
}

function settingsRefused(error: unknown): never {
  const { code, problems } = failure(error);
  back(`error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

/** Record a phase gate and approval reference for a v1.1 module (needs system.configure). */
export async function recordGate(formData: FormData): Promise<void> {
  const key = String(formData.get('key') ?? '').trim();
  const gate = String(formData.get('gate') ?? '') as PhaseGate;
  const approvalRef = String(formData.get('approvalRef') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!key || !gate || !approvalRef || !reason) {
    back('error=invalid_request&problems=required_fields_missing');
  }

  try {
    const api = await staffApi();
    await api.recordFeatureGate(key, gate, approvalRef, reason);
  } catch (error) {
    settingsRefused(error);
  }

  back('done=gate_recorded');
}

/** Enable a feature module after its gate is recorded. */
export async function enableFeature(formData: FormData): Promise<void> {
  const key = String(formData.get('key') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const confirmed = formData.get('confirmEnable') === '1';

  if (!key || !reason || reason.length < 3) {
    back('error=invalid_request&problems=reason_required');
  }
  if (!confirmed) {
    back('error=invalid_request&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.enableFeature(key, reason);
  } catch (error) {
    settingsRefused(error);
  }

  back('done=feature_enabled');
}

/** Disable a feature module at any time. */
export async function disableFeature(formData: FormData): Promise<void> {
  const key = String(formData.get('key') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const confirmed = formData.get('confirmDisable') === '1';

  if (!key || !reason || reason.length < 3) {
    back('error=invalid_request&problems=reason_required');
  }
  if (!confirmed) {
    back('error=invalid_request&problems=confirmation_required');
  }

  try {
    const api = await staffApi();
    await api.disableFeature(key, reason);
  } catch (error) {
    settingsRefused(error);
  }

  back('done=feature_disabled');
}
