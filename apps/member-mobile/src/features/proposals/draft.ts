import type { ProposalCategory, ProposalDetail, ProposalInput } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';

import { NO_AREA, type AreaChoice } from '@/features/area/AreaFields';
import { deviceDraftStorage, type OwnedDraft } from '@/lib/deviceDraft';

import { LIMITS, PROPOSAL_CATEGORIES } from './labels';

/** What the member writes on M16; a revision (after "Needs changes") keeps the area it had. */
export type ProposalFields = {
  title: string;
  category: ProposalCategory | null;
  area: AreaChoice;
  problem: string;
  solution: string;
  benefit: string;
  /** Whole rupees as typed, digits only; empty when not given. */
  cost: string;
  evidence: string;
};

/**
 * A new proposal being written, kept on the device after every change so it survives a lost
 * connection or a closed app. The reference is made once per draft, so sending it again returns
 * the first proposal instead of a second one.
 */
export type ProposalDraft = OwnedDraft & ProposalFields & { clientReference: string };

export const proposalDraftStorage = deviceDraftStorage('proposal-draft.json', 'mp.proposalDraft');

const EMPTY: ProposalFields = {
  title: '',
  category: null,
  area: NO_AREA,
  problem: '',
  solution: '',
  benefit: '',
  cost: '',
  evidence: '',
};

export function newProposalDraft(memberId: string): ProposalDraft {
  return { ...EMPTY, memberId, clientReference: Crypto.randomUUID() };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function code(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** The saved draft, or null when it cannot be read. */
export function parseProposalDraft(saved: string): ProposalDraft | null {
  try {
    const value = JSON.parse(saved) as Partial<ProposalDraft>;
    if (typeof value.memberId !== 'string' || typeof value.clientReference !== 'string') return null;
    const area = (value.area ?? {}) as Partial<AreaChoice>;
    const category = PROPOSAL_CATEGORIES.find((known) => known === value.category) ?? null;
    return {
      memberId: value.memberId,
      clientReference: value.clientReference,
      title: text(value.title),
      category,
      area: { district: code(area.district), ds: code(area.ds), gn: code(area.gn) },
      problem: text(value.problem),
      solution: text(value.solution),
      benefit: text(value.benefit),
      cost: text(value.cost).replace(/\D/g, ''),
      evidence: text(value.evidence),
    };
  } catch {
    return null;
  }
}

/** A revision starts from what the proposal says now. */
export function fieldsFrom(proposal: ProposalDetail): ProposalFields {
  return {
    title: proposal.title,
    category: proposal.category,
    area: NO_AREA,
    problem: proposal.problem,
    solution: proposal.solution,
    benefit: proposal.benefit,
    cost: proposal.costEstimate ? String(Math.round(Number(proposal.costEstimate))) : '',
    evidence: proposal.evidence ?? '',
  };
}

/** The smallest area chosen: a GN division, else a DS division, else a district. */
export function chosenArea(area: AreaChoice): ProposalInput['area'] | null {
  if (area.gn) return { level: 'gn', code: area.gn };
  if (area.ds) return { level: 'ds', code: area.ds };
  if (area.district) return { level: 'district', code: area.district };
  return null;
}

export type ProposalField = 'title' | 'category' | 'area' | 'problem' | 'solution' | 'benefit';

/** The fields that still need work, checked against the API's limits before review. */
export function proposalProblems(fields: ProposalFields, needsArea: boolean): ProposalField[] {
  const problems: ProposalField[] = [];
  const length = (value: string) => value.trim().length;
  if (length(fields.title) < LIMITS.titleMin) problems.push('title');
  if (!fields.category) problems.push('category');
  if (needsArea && !chosenArea(fields.area)) problems.push('area');
  if (length(fields.problem) < LIMITS.problemMin) problems.push('problem');
  if (length(fields.solution) < LIMITS.solutionMin) problems.push('solution');
  if (length(fields.benefit) < LIMITS.benefitMin) problems.push('benefit');
  return problems;
}

/** The optional parts, sent as null when left empty. */
export function optionalParts(fields: ProposalFields): { costEstimate: number | null; evidence: string | null } {
  return {
    costEstimate: fields.cost ? Number(fields.cost) : null,
    evidence: fields.evidence.trim() || null,
  };
}
