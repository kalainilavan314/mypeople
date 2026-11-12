'use server';

import type { FinanceProductionControlInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGER_CONTROLS = new Set(['enhanced_review_threshold_minor', 'slip_retention_days']);
const CONTROL_KEYS = new Set([
  'enhanced_review_threshold_minor',
  'statutory_reporting_mode',
  'slip_retention_days',
  'third_party_payment_mode',
  'pilot_currency',
]);

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function back(query: string): never {
  redirect(`/finance-readiness?${query}`);
}

export async function recordFinanceProductionControl(formData: FormData): Promise<void> {
  const controlKey = value(formData, 'controlKey');
  const decisionRevisionId = value(formData, 'decisionRevisionId');
  if (!CONTROL_KEYS.has(controlKey) || !UUID.test(decisionRevisionId)) {
    back('error=invalid_control_basis');
  }
  if (value(formData, 'confirmApprovedBasis') !== '1') {
    back('error=confirmation_required');
  }

  const rawValue = value(formData, 'controlValue');
  let integerValue: number | null = null;
  if (INTEGER_CONTROLS.has(controlKey)) {
    const parsed = Number(rawValue);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) back('error=invalid_control_value');
    integerValue = parsed;
  }

  const input: FinanceProductionControlInput = {
    controlKey: controlKey as FinanceProductionControlInput['controlKey'],
    decisionRevisionId,
    integerValue,
    textValue: INTEGER_CONTROLS.has(controlKey) ? null : rawValue,
    evidenceRef: value(formData, 'evidenceRef'),
    reason: value(formData, 'reason'),
  };

  try {
    await (await staffApi()).recordFinanceProductionControl(input);
  } catch (error) {
    back(`error=${encodeURIComponent((error as Error).message)}`);
  }
  back(`done=${encodeURIComponent(`${controlKey}_recorded`)}`);
}
