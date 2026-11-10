'use server';

import type {
  GovernancePolicyInput,
  OperationalControlInput,
  Tier5CertificationInput,
} from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const aware = (input: string) => input && !/(Z|[+-]\d\d:\d\d)$/.test(input) ? `${input}:00+05:30` : input;

function back(query: string): never {
  redirect(`/operations-governance?${query}`);
}

function refused(error: unknown): never {
  const result = failure(error);
  back(`error=${encodeURIComponent(result.code)}&problems=${encodeURIComponent(result.problems.join(','))}`);
}

export async function saveOperationalControl(data: FormData): Promise<void> {
  const integerValue = Number(value(data, 'integerValue'));
  const input: OperationalControlInput = {
    controlKey: value(data, 'controlKey') as OperationalControlInput['controlKey'],
    integerValue,
    decisionRevisionId: value(data, 'decisionRevisionId'),
    reason: value(data, 'reason'),
    confirmApprovedBasis: data.get('confirmApprovedBasis') === '1',
  };
  if (!input.decisionRevisionId || !Number.isInteger(integerValue) || input.reason.length < 10 || !input.confirmApprovedBasis) {
    back('error=invalid_request&problems=required_fields_missing');
  }
  try {
    await (await staffApi()).recordOperationalControl(input);
  } catch (error) {
    refused(error);
  }
  back('done=operational_control_recorded');
}

export async function publishPolicyVersion(data: FormData): Promise<void> {
  const input: GovernancePolicyInput = {
    policyKey: value(data, 'policyKey'),
    policyType: value(data, 'policyType') as GovernancePolicyInput['policyType'],
    version: value(data, 'version'),
    locale: value(data, 'locale') as GovernancePolicyInput['locale'],
    contentText: value(data, 'contentText'),
    approvalReference: value(data, 'approvalReference'),
    approvedAt: aware(value(data, 'approvedAt')),
    effectiveFrom: aware(value(data, 'effectiveFrom')),
    confirmImmutablePublication: data.get('confirmImmutablePublication') === '1',
  };
  if (
    !input.policyKey || !input.version || !input.contentText || input.approvalReference.length < 3 ||
    !input.approvedAt || !input.effectiveFrom || !input.confirmImmutablePublication
  ) {
    back('error=invalid_request&problems=required_fields_missing');
  }
  try {
    await (await staffApi()).publishGovernancePolicy(input);
  } catch (error) {
    refused(error);
  }
  back('done=policy_version_published');
}

export async function recordTier5Certification(data: FormData): Promise<void> {
  const input: Tier5CertificationInput = {
    assignmentId: value(data, 'assignmentId'),
    decision: value(data, 'decision') as Tier5CertificationInput['decision'],
    periodStart: value(data, 'periodStart'),
    periodEnd: value(data, 'periodEnd'),
    reviewerName: value(data, 'reviewerName'),
    reviewerTitle: value(data, 'reviewerTitle'),
    evidenceRef: value(data, 'evidenceRef'),
    reason: value(data, 'reason'),
    certifiedAt: value(data, 'certifiedAt'),
    confirmExternalReview: data.get('confirmExternalReview') === '1',
  };
  if (
    !input.assignmentId || !input.periodStart || !input.periodEnd || input.reviewerName.length < 2 ||
    input.reviewerTitle.length < 2 || input.evidenceRef.length < 3 || input.reason.length < 10 ||
    !input.certifiedAt || !input.confirmExternalReview
  ) {
    back('error=invalid_request&problems=required_fields_missing');
  }
  try {
    await (await staffApi()).recordTier5Certification(input);
  } catch (error) {
    refused(error);
  }
  back('done=tier5_certification_recorded');
}
