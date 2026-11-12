import type {
  CaseChallengeDecisionInput,
  CaseDistrictDecisionInput,
  CaseExecutiveDecisionInput,
  CaseForwardInput,
  CasePublicSummaryInput,
} from '@my-people/api-client';

import { REOPEN_STAGES, evidenceRefsFrom, type ReopenStage } from './stages.ts';

/**
 * What a case action hands back to its form after a refusal: the error and problem codes and the
 * values typed, so nothing has to be typed again. Nothing here goes into the address.
 */
export type CaseFormState = {
  error: string;
  problems: string[];
  values: Record<string, string>;
  /** Changes on every refused attempt, so the form's error summary is announced again. */
  attempt: number;
} | null;

type FormLike = { get(name: string): FormDataEntryValue | null };

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function text(form: FormLike, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function uuidOrNull(form: FormLike, name: string): string | null {
  const value = text(form, name);
  return UUID.test(value) ? value : null;
}

function dateOrNull(form: FormLike, name: string): string | null {
  const value = text(form, name);
  return DATE.test(value) ? value : null;
}

/** The typed values to give back after a refusal (text only; files are never echoed). */
export function valuesOf(form: FormLike, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, text(form, name)]));
}

type Read<T> = { input: T | null; problems: string[] };

/** FR-WEB-017: the three completeness checks and a named divisional owner. */
export function readForward(form: FormLike): Read<CaseForwardInput> {
  const locationConfirmed = form.get('locationConfirmed') === '1';
  const descriptionClear = form.get('descriptionClear') === '1';
  const evidenceReviewed = form.get('evidenceReviewed') === '1';
  const ownerId = uuidOrNull(form, 'ownerId');
  const problems: string[] = [];
  if (!(locationConfirmed && descriptionClear && evidenceReviewed)) problems.push('completeness_check_incomplete');
  if (!ownerId) problems.push('owner_required');
  if (problems.length > 0 || !ownerId) return { input: null, problems };
  return {
    input: { locationConfirmed, descriptionClear, evidenceReviewed, ownerId, note: text(form, 'note') },
    problems,
  };
}

/** FR-WEB-021: act within delegated authority, or escalate with the reason and the decision needed. */
export function readDistrictDecision(form: FormLike): Read<CaseDistrictDecisionInput> {
  const decision = text(form, 'decision');
  if (decision === 'act') {
    const input: CaseDistrictDecisionInput = {
      decision,
      authority: text(form, 'authority'),
      resources: text(form, 'resources'),
      office: text(form, 'office'),
      ownerId: uuidOrNull(form, 'ownerId'),
      dueDate: dateOrNull(form, 'dueDate'),
    };
    const problems = [
      ...(input.authority ? [] : ['authority_required']),
      ...(input.resources ? [] : ['resources_required']),
      ...(input.office ? [] : ['office_required']),
      ...(input.dueDate ? [] : ['due_date_required']),
      ...(input.ownerId ? [] : ['owner_required']),
    ];
    return { input: problems.length ? null : input, problems };
  }
  if (decision === 'escalate') {
    const input: CaseDistrictDecisionInput = {
      decision,
      reason: text(form, 'reason'),
      decisionRequired: text(form, 'decisionRequired'),
      regionalOwnerId: uuidOrNull(form, 'regionalOwnerId'),
    };
    const problems = [
      ...(input.reason && input.decisionRequired ? [] : ['reason_and_decision_required']),
      ...(input.regionalOwnerId ? [] : ['regional_owner_required']),
    ];
    return { input: problems.length ? null : input, problems };
  }
  return { input: null, problems: ['decision_required'] };
}

/** FR-WEB-024: approve with every condition named, return with a question, or decline with a reason. */
export function readExecutiveDecision(form: FormLike): Read<CaseExecutiveDecisionInput> {
  const decision = text(form, 'decision');
  if (decision === 'approve') {
    const input: CaseExecutiveDecisionInput = {
      decision,
      conditions: text(form, 'conditions'),
      implementerId: uuidOrNull(form, 'implementerId'),
      scope: text(form, 'scope'),
      reportingDuty: text(form, 'reportingDuty'),
      dueDate: dateOrNull(form, 'dueDate'),
    };
    const problems = [
      ...(input.conditions && input.implementerId ? [] : ['conditions_and_implementer_required']),
      ...(input.scope && input.dueDate ? [] : ['scope_and_due_date_required']),
      ...(input.reportingDuty ? [] : ['reporting_duty_required']),
    ];
    return { input: problems.length ? null : input, problems };
  }
  if (decision === 'return') {
    const question = text(form, 'question');
    return question ? { input: { decision, question }, problems: [] } : { input: null, problems: ['question_required'] };
  }
  if (decision === 'decline') {
    const reason = text(form, 'reason');
    return reason ? { input: { decision, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
  }
  return { input: null, problems: ['decision_required'] };
}

/** FR-WEB-027: an accepted challenge reopens at a stage with a new owner; a rejected one gives the reason. */
export function readChallengeDecision(form: FormLike): Read<CaseChallengeDecisionInput> {
  const choice = text(form, 'accept');
  const reason = text(form, 'reason');
  if (choice === 'reject') {
    return reason ? { input: { accept: false, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
  }
  if (choice !== 'accept') return { input: null, problems: ['decision_required'] };
  const stageText = text(form, 'stage');
  const stage = (REOPEN_STAGES as readonly string[]).includes(stageText) ? (stageText as ReopenStage) : null;
  const ownerId = stage ? uuidOrNull(form, 'ownerId') : null;
  const dueDate = dateOrNull(form, 'dueDate');
  const problems = [
    ...(reason ? [] : ['reason_required']),
    ...(stage ? [] : ['stage_required']),
    ...(stage && !ownerId ? ['owner_required'] : []),
    ...(stage === 'implementation' && !dueDate ? ['due_date_required'] : []),
  ];
  if (problems.length > 0) return { input: null, problems };
  return {
    input: { accept: true, reason, stage, ownerId, dueDate: stage === 'implementation' ? dueDate : null },
    problems,
  };
}

/** BR-032: publish needs the title and summary in Tamil and English; withholding needs a reason. */
export function readPublicSummary(form: FormLike): Read<CasePublicSummaryInput> {
  const choice = text(form, 'publish');
  if (choice === 'withhold') {
    const reason = text(form, 'reason');
    return reason ? { input: { publish: false, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
  }
  if (choice !== 'publish') return { input: null, problems: ['decision_required'] };
  const input: CasePublicSummaryInput = {
    publish: true,
    titleTa: text(form, 'titleTa'),
    titleEn: text(form, 'titleEn'),
    summaryTa: text(form, 'summaryTa'),
    summaryEn: text(form, 'summaryEn'),
  };
  const complete = input.titleTa && input.titleEn && input.summaryTa && input.summaryEn;
  return complete ? { input, problems: [] } : { input: null, problems: ['bilingual_summary_required'] };
}

/** FR-WEB-026: a closing report needs evidence (references or photos) and both member summaries. */
export function closingProblems(form: FormLike, photoCount: number): string[] {
  const problems: string[] = [];
  if (evidenceRefsFrom(text(form, 'evidenceRefs')).length === 0 && photoCount === 0) problems.push('evidence_required');
  if (!text(form, 'summaryTa') || !text(form, 'summaryEn')) problems.push('bilingual_summary_required');
  return problems;
}
